const { hideBin } = require('yargs/helpers');
const axios = require('axios');
const yargs = require('yargs/yargs');
const rimraf = require('rimraf');
const { argv } = yargs(hideBin(process.argv));
const fs = require('fs');
const path = require('path');

const { url } = argv;
const palette = require('image-palette');
const pixels = require('image-pixels');
const convert = require('color-convert');
const ColorThief = require('colorthief');
const { createCanvas } = require('canvas');
const { LogoScrape } = require('logo-scrape');
const stream = require('stream');
const util = require('util');
const getColors = require('get-svg-colors');
const puppeteer = require('puppeteer');
const { PALETTE_ELEMENT_WIDTH, PALETTES_FOLDER, TMP_FOLDER, PALETTE_MAX_COLORS, SELECTORS } = require('./constants');

const finished = util.promisify(stream.finished);

const rgbArrayToHex = (colors) => {
  const rgbColorsArray = colors.map((color) =>
    color
      .replace(/rgba|rgb|\(|\)|\s/gi, '')
      .split(',')
      .map(parseFloat)
  );
  return [...new Set(rgbColorsArray.map((el) => `#${convert.rgb.hex(...el)}`))];
};

const getPalette = async (fileName, paletteMaxColors = PALETTE_MAX_COLORS) => {
  const palette = { mainColor: '#FFFFFF', colors: [] };

  if (fileName && !fileName.includes('svg')) {
    try {
      const mainColor = await ColorThief.getColor(path.join(__dirname, TMP_FOLDER, fileName));
      const mainColorHEX = `#${convert.rgb.hex(...mainColor)}`;
      palette.mainColor = mainColorHEX;
    } catch (err) {
      console.log(`Error during getting main  color  from ${fileName}`, err.message || err.stack);
    }

    try {
      const paletteColors = await ColorThief.getPalette(path.join(__dirname, TMP_FOLDER, fileName), paletteMaxColors);
      const paletteColorsHex = [...new Set(paletteColors.map((el) => `#${convert.rgb.hex(...el)}`))];
      palette.colors = paletteColorsHex;
    } catch (err) {
      console.log(`Error during getting main  color from ${fileName}`, err.message || err.stack);
    }
  } else {
    const paletteColors = getColors(path.join(__dirname, TMP_FOLDER, fileName));
    const paletteColorsHex = [...new Set(paletteColors.fills.map((color) => color.hex()))];
    palette.mainColor = paletteColorsHex[0];
    palette.colors = paletteColorsHex;
  }

  return palette;
};

const savePalette = async (palette, fileName) => {
  const width = palette.colors.length * PALETTE_ELEMENT_WIDTH;
  const height = PALETTE_ELEMENT_WIDTH * (palette.mainColor ? 2 : 1);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  palette.colors.forEach((color, idx) => {
    context.fillStyle = color;
    context.fillRect(idx * PALETTE_ELEMENT_WIDTH, 0, PALETTE_ELEMENT_WIDTH, PALETTE_ELEMENT_WIDTH);
  });
  if (palette.mainColor) {
    context.fillStyle = palette.mainColor;
    context.fillRect(0, PALETTE_ELEMENT_WIDTH, width, PALETTE_ELEMENT_WIDTH);
    // fileName = fileName.split('.').slice(0, -1).join('.')
  }

  const out = fs.createWriteStream(path.join(__dirname, PALETTES_FOLDER, `palette_${fileName}.png`));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await finished(out);
  console.log(`The PNG palette file for ${fileName} created.`);
};

const saveImage = async (url, fileName = '') => {
  try {
    const response = await axios({
      url,
      method: 'get',
      responseType: 'stream',
    });

    fileName = fileName || url.split('/').pop();

    const stream = fs.createWriteStream(path.join(__dirname, 'tmp', fileName));
    response.data.pipe(stream);
    await finished(stream);
  } catch (e) {
    console.log(e.message, url, fileName);
    return false;
  }
  return fileName;
};

async function getPageIcons(url) {
  const palettes = [];
  await saveImage(`https://www.google.com/s2/favicons?sz=64&domain_url=${url}`, 'icon.png');

  const palette = await getPalette('icon.png');

  await savePalette(palette, 'icon.png');

  palettes.push({ fileName: 'icon.png', palette });

  const logo = await LogoScrape.getLogo(url);
  const logos = await LogoScrape.getLogos(url);
  const filteredLogos = [logo, ...logos].filter((logoObject) => logoObject && !logoObject.url.endsWith('.ico'));
  for (const logoObject of filteredLogos) {
    if (!logoObject.url.includes('data:image')) {
      const fileName = await saveImage(logoObject.url);
      if (fileName) {
        const palette = await getPalette(fileName);
        palette && (await savePalette(palette, fileName));
        palettes.push({ fileName, palette });
      }
    }
  }
  return palettes;
}

async function removeImagesAndBackgrounds(page) {
  try {
    const data = await page.evaluate((selectors, properties) => {
      document.querySelectorAll('img').forEach((el) => {
        el.parentNode.removeChild(el);
      });
      document.querySelectorAll('video').forEach((el) => {
        el.parentNode.removeChild(el);
      });
      const allElements = document.getElementsByTagName('*');

      for (let i = 0, { length } = allElements; i < length; i++) {
        const style = window.getComputedStyle(allElements[i]);
        if (style.background.includes('url') || style.backgroundImage) {
          allElements[i].style.backgroundImage = 'none';
        }
      }
    });
  } catch (e) {
    console.log('an expection on page.evaluate ', e);
  }
}

async function processScreenshots(domainurl) {
  const palettes = [];
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('error', (err) => {
    console.log('error happen at the page: ', err);
  });

  page.on('pageerror', (pageerr) => {
    console.log('pageerror occurred: ', pageerr);
  });

  page.setViewport({ width: 1920, height: 1080 });
  await page.goto(domainurl);
  await page.waitFor(1000);
  await removeImagesAndBackgrounds(page);
  const fileName = `screenshot_${domainurl.replace(/[\/|:|\.]/g, '_')}.png`;
  await page.screenshot({
    type: 'png',
    path: path.join(__dirname, TMP_FOLDER, fileName),
  });

  if (fileName) {
    const palette = await getPalette(fileName);
    if (palette) {
      await savePalette(palette, fileName);
      palettes.push({ fileName, palette });
    }
  }

  const props = await getComputedStyleColors(page, SELECTORS.buttons.selectors, SELECTORS.buttons.properties);

  Object.keys(props).forEach((key) => {
    props[key] = rgbArrayToHex(props[key]);
    palettes.push({ fileName: `${key}_buttons_palette`, palette: { colors: props[key] } });
    savePalette({ colors: props[key] }, `${key}_buttons_palette`);
  });

  console.log(props);
  await browser.close();
  console.log('Screenshot processed');
  return palettes;
}

async function getComputedStyleColors(page, selectors = [], properties = []) {
  try {
    const data = await page.evaluate(
      (selectors, properties) => {
        const obj = properties.reduce((acc, el) => {
          if (!acc.hasOwnProperty(el)) {
            acc[el] = new Set();
          }
          return acc;
        }, {});

        selectors.forEach((selector) => {
          const elements = [...document.querySelectorAll(selector)];
          elements.forEach((el) => {
            el.focus();
            const computedStyle = window.getComputedStyle(el);
            properties.forEach((property) => {
              obj[property].add(computedStyle.getPropertyValue(property));
            });
          });
        });

        Object.keys(obj).forEach((key) => {
          obj[key] = [...obj[key]];
        });
        return obj;
      },
      selectors,
      properties
    );

    return data;
  } catch (e) {
    console.log('an expection on page.evaluate ', e);
  }
}

async function scrape(url) {
  await new Promise((resolve) => rimraf(path.join(__dirname, TMP_FOLDER, '*'), resolve));
  await new Promise((resolve) => rimraf(path.join(__dirname, PALETTES_FOLDER, '*'), resolve));

  const imagePalettes = await getPageIcons(url);
  const htmlPalettes = await processScreenshots(url);
  return [...imagePalettes, ...htmlPalettes];
}

module.exports = { scrape };
