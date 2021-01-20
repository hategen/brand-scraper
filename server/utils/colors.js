const debug = require('debug')('colors');
const convert = require('color-convert');
const axios = require('axios');
const path = require('path');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const fsPromise = require('fs').promises;
const ColorThief = require('colorthief');
const { createCanvas } = require('canvas');
const getColors = require('get-svg-colors');
const { uniqWith, isEqual, min, max, sum } = require('lodash');
const { DELTAE94_DIFF_STATUS } = require('../constants.js');
const gm = require('gm').subClass({ imageMagick: true });
const svg2png = require('svg2png');
const svg2img = require('svg2img');
const https = require('https');

const color = require('color');

const deltaE94 = (hex1, hex2) => {
  const lab1 = color(hex1).lab().color;
  const lab2 = color(hex2).lab().color;
  const WEIGHT_L = 1;
  const WEIGHT_C = 1;
  const WEIGHT_H = 1;
  const L1 = lab1[0];
  const a1 = lab1[1];
  const b1 = lab1[2];
  const L2 = lab2[0];
  const a2 = lab2[1];
  const b2 = lab2[2];
  const dL = L1 - L2;
  const da = a1 - a2;
  const db = b1 - b2;
  const xC1 = Math.sqrt(a1 * a1 + b1 * b1);
  const xC2 = Math.sqrt(a2 * a2 + b2 * b2);
  let xDL = L2 - L1;
  let xDC = xC2 - xC1;
  const xDE = Math.sqrt(dL * dL + da * da + db * db);
  let xDH =
    Math.sqrt(xDE) > Math.sqrt(Math.abs(xDL)) + Math.sqrt(Math.abs(xDC))
      ? Math.sqrt(xDE * xDE - xDL * xDL - xDC * xDC)
      : 0;
  const xSC = 1 + 0.045 * xC1;
  const xSH = 1 + 0.015 * xC1;
  xDL /= WEIGHT_L;
  xDC /= WEIGHT_C * xSC;
  xDH /= WEIGHT_H * xSH;
  return Math.sqrt(xDL * xDL + xDC * xDC + xDH * xDH);
};

const getColorDiffStatus = (d) => {
  if (d < DELTAE94_DIFF_STATUS.NA) {
    return 'N/A';
  }
  // Not perceptible by human eyes
  if (d <= DELTAE94_DIFF_STATUS.PERFECT) {
    return 'Perfect';
  }
  // Perceptible through close observation
  if (d <= DELTAE94_DIFF_STATUS.CLOSE) {
    return 'Close';
  }
  // Perceptible at a glance
  if (d <= DELTAE94_DIFF_STATUS.GOOD) {
    return 'Good';
  }
  // Colors are more similar than opposite
  if (d < DELTAE94_DIFF_STATUS.SIMILAR) {
    return 'Similar';
  }
  return 'Wrong';
};

const {
  PALETTE_ELEMENT_WIDTH,
  PALETTES_FOLDER,
  TMP_FOLDER,
  LOGO_PALETTE_MAX_COLORS,
  FULL_SCREENSHOT_PALETTE_MAX_COLORS,
  LOGO_BACKGROUND_PALETTE_MAX_COLORS,
  PALETTE_PIXEL_SKIP,
} = require('../constants');

const stream = require('stream');
const util = require('util');

const getRange = (data) => Math.abs(min(data) - max(data));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reldist = (a, b) => (b - a) / b;

const mean = (data = []) => sum(data) / data.length;
// gets the array with 'gradient'  of  value change in array
const gradients = (data) =>
  data.reduce((acc, el, idx, arr) => {
    if (idx > 0) {
      acc.push(el - arr[idx - 1]);
    }
    return acc;
  }, []);

const finished = util.promisify(stream.finished);

const getLuminosity = (hexColor) => color(hexColor).luminosity();

const getPaletteMedianLuminocity = (colors = []) => mean(colors.map(getLuminosity));

const getPaletteDistributionScore = (colors = [], criteria, distance = reldist) => {
  const dist = colors.map(criteria).sort();

  const ideal = getRange(dist) / (dist.length - 1 || 1);

  const score = (x) => clamp(1 - distance(x, ideal), 0, 1);

  return mean(gradients(dist).map(score));
};

const saveSVGData = async (data, type = 'svg') => {
  const safeFileName = `${uuid()}.${type}`;
  const fileName = safeFileName;
  try {
    fs.writeFileSync(path.join(__dirname, '..', 'tmp', safeFileName), data);
    return {
      fileName,
      safeFileName,
    };
  } catch (e) {
    debug(e.message, data, fileName, safeFileName);
    return false;
  }
};
const saveImage = async (url, fileName = '') => {
  let safeFileName = '';
  try {
    const response = await axios({
      url,
      method: 'get',
      responseType: 'stream',
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    const responseUrl = response.data.responseUrl;
    //removing querystring
    fileName = fileName || responseUrl.split('/').pop().split('?').shift();

    const fileExtension = fileName.split('.').pop();
    safeFileName = `${uuid()}.${fileExtension}`;

    const stream = fs.createWriteStream(path.join(__dirname, '..', 'tmp', safeFileName));
    response.data.pipe(stream);
    await finished(stream);

    return {
      fileName,
      safeFileName,
    };
  } catch (e) {
    debug(e.message, url, fileName, safeFileName);
    return false;
  }
};

const rgbArrayToHex = (colors = []) => {
  const colorsArray = Array.isArray(colors) ? colors : [colors];
  const rgbColorsArray = colorsArray.map(rgbToHex);
  return [...new Set(rgbColorsArray)];
};

const rgbToHex = (color = '') => {
  const colorArray = color
    .replace(/rgba|rgb|\(|\)|\s/gi, '')
    .split(',')
    .map(parseFloat);

  return `#${convert.rgb.hex(...colorArray)}`;
};

const getPalettesFromTags = (tagProps = [], tag) => {
  const palettes = [];
  tagProps.forEach((tagColors) => {
    const palette = {
      palette: { colors: [] },
      tag: `${tag}`,
      weight: tagColors.weight,
    };
    delete tagColors.weight;

    Object.keys(tagColors).forEach((tagColorProperty) => {
      palette.palette.colors.push(rgbToHex(tagColors[tagColorProperty]));
      palette.tag = `${palette.tag}_${tagColorProperty}`;
    });

    palettes.push(palette);
  });
  return palettes;
};

const savePalette = async (palette, fileName) => {
  /*  const width = palette.colors.length * PALETTE_ELEMENT_WIDTH;
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

  const out = fs.createWriteStream(path.join(__dirname, '..', PALETTES_FOLDER, `palette_${fileName}.png`));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await finished(out);
  debug(`The PNG palette file for ${fileName} created.`);*/
};

const getColorThiefPalette = async (fileName, paletteMaxColors = PALETTE_MAX_COLORS) => {
  const palette = {
    mainColor: '#FFFFFF',
    colors: [],
  };

  try {
    const mainColor = await ColorThief.getColor(path.join(__dirname, '..', TMP_FOLDER, fileName), PALETTE_PIXEL_SKIP);
    const mainColorHEX = `#${convert.rgb.hex(...mainColor)}`;
    palette.mainColor = mainColorHEX;
  } catch (err) {
    debug(`Error during getting main  color from ${fileName}`, err.message || err.stack);
    palette.colors = ['#FFFFFF'];
    return palette;
  }

  try {
    const paletteColors = await ColorThief.getPalette(
      path.join(__dirname, '..', TMP_FOLDER, fileName),
      paletteMaxColors,
      PALETTE_PIXEL_SKIP
    );
    const paletteColorsHex = [...new Set(paletteColors.map((el) => `#${convert.rgb.hex(...el)}`))];
    palette.colors = paletteColorsHex;
  } catch (err) {
    debug(`Error during getting main  color from ${fileName}`, err.message || err.stack);
    return palette; //returning default  palette
  }
  return palette;
};

const convertSVGtoPNG = async (fileName) => {
  return fsPromise
    .readFile(path.join(__dirname, '..', TMP_FOLDER, fileName))
    .then((buff) => svg2png(buff, { width: 1000, height: 500 }))
    .then((buffer) => {
      const newFileName = fileName.replace('.svg', '.png');
      fs.writeFileSync(path.join(__dirname, '..', TMP_FOLDER, newFileName), buffer);
      return newFileName;
    })
    .catch((err) => {
      debug('error during converting svg=>png', err);
      throw err;
    });
};

const getPalette = async (fileName, paletteMaxColors = PALETTE_MAX_COLORS) => {
  let palette = {
    mainColor: '#FFFFFF',
    colors: [],
  };

  if (fileName && fileName.includes('svg')) {
    const paletteColors = getColors(path.join(__dirname, '..', TMP_FOLDER, fileName));
    const paletteColorsHex = [...new Set(paletteColors.fills.map((color) => color.hex()))];
    //no colors extracted ==> rasterize and get  as usual
    if (!paletteColorsHex.length || paletteColorsHex.length === 1) {
      const newFileName = await convertSVGtoPNG(fileName);
      palette = await getColorThiefPalette(newFileName, paletteMaxColors);
      palette;
    } else {
      palette.mainColor = paletteColorsHex[0];
      palette.colors = paletteColorsHex;
    }
  } else {
    palette = await getColorThiefPalette(fileName, paletteMaxColors);
  }

  palette.mainColor = palette.mainColor.toUpperCase();
  palette.colors = palette.colors.map((el) => el.toUpperCase());
  return palette;
};
//gm
// stream->stream
const convertICOToPNG = (fileName) => {
  return new Promise((resolve, reject) => {
    const convertedFilename = `${fileName.replace('.ico', '.png')}`;
    gm()
      .command('magick')
      .in(path.join(__dirname, '..', 'tmp', fileName))
      .out('-thumbnail')
      .out('16x16')
      .out('-alpha')
      .out('on')
      .out('-background')
      .out('none')
      .out('-flatten')
      .write(`${path.join(__dirname, '..', 'tmp', convertedFilename)}`, (err) => {
        if (err) {
          debug('ERROR converting ico', err);
          reject(err);
        }
        resolve(convertedFilename);
      });
  });
};

async function getPageImagesPalettes(images = []) {
  const palettes = [];
  const filteredImages = images.filter((imageObject) => imageObject);
  for (const image of filteredImages) {
    try {
      if (!image.data) {
        let { safeFileName, fileName } = await saveImage(image.url);

        if ((fileName && fileName.endsWith('.ico')) || (safeFileName && safeFileName.endsWith('.ico'))) {
          safeFileName = await convertICOToPNG(safeFileName);
        }
        if (safeFileName) {
          const imagePalette = await getPalette(safeFileName, LOGO_PALETTE_MAX_COLORS);
          //    imagePalette && (await savePalette(imagePalette, safeFileName));
          palettes.push({
            safeFileName,
            fileName,
            palette: imagePalette,
            type: image.type,
            priority: image.priority,
            size: image.size || undefined,
            boundingRect: image.boundingRect,
          });
        }
      } else {
        let svgBuffer;
        let type = 'svg';
        if (image.url.type && image.url.type.includes('svg')) {
          svgBuffer = image.url;
        } else if (image.url.type && image.url.type.includes('png')) {
          svgBuffer = image.url;
          type = 'png';
        } else {
          svgBuffer = Buffer.from(image.url);
        }

        const { safeFileName, fileName } = await saveSVGData(svgBuffer, type);
        if (safeFileName) {
          const imagePalette = await getPalette(safeFileName, LOGO_PALETTE_MAX_COLORS);
          //    imagePalette && (await savePalette(imagePalette, safeFileName));
          palettes.push({
            safeFileName,
            fileName,
            palette: imagePalette,
            type: image.type,
            priority: image.priority,
            boundingRect: image.boundingRect,
          });
        }
      }
    } catch (err) {
      debug(err);
    }
  }
  return palettes;
}

const getUniqueButtonsColors = (buttonColors) => {
  const uniquebuttonColors = uniqWith(buttonColors, isEqual);

  uniquebuttonColors.forEach((el) => {
    const count = buttonColors.filter((nuel) => isEqual(nuel, el)).length;
    el.weight = count;
  });
  return uniquebuttonColors;
};

module.exports = {
  getPageImagesPalettes,
  rgbArrayToHex,
  getPalette,
  savePalette,
  getPalettesFromTags,
  getUniqueButtonsColors,
  getPaletteDistributionScore,
  getLuminosity,
  deltaE94,
  getColorDiffStatus,
  getPaletteMedianLuminocity,
};
