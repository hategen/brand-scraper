const debug = require('debug')('colors');
const convert = require('color-convert');
const axios = require('axios');
const path = require('path');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const ColorThief = require('colorthief');
const { createCanvas } = require('canvas');
const getColors = require('get-svg-colors');

const {
  PALETTE_ELEMENT_WIDTH,
  PALETTES_FOLDER,
  TMP_FOLDER,
  PALETTE_MAX_COLORS,
  PALETTE_PIXEL_SKIP,
} = require('../constants');
const stream = require('stream');
const util = require('util');

const finished = util.promisify(stream.finished);

const saveSVGData = async (data) => {
  const safeFileName = `${uuid()}.svg`;
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
    });
    //removing querystring
    fileName = fileName || url.split('/').pop().split('?').shift();

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

const getPalettesFromTags = (props = {}, tag) => {
  const palettes = [];
  Object.keys(props).forEach((key) => {
    props[key] = rgbArrayToHex(props[key]);
    palettes.push({
      palette: { colors: props[key] },
      tag: `${tag}_${key}`,
    });
  });
  return palettes;
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

  const out = fs.createWriteStream(path.join(__dirname, '..', PALETTES_FOLDER, `palette_${fileName}.png`));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await finished(out);
  debug(`The PNG palette file for ${fileName} created.`);
};

const getPalette = async (fileName, paletteMaxColors = PALETTE_MAX_COLORS) => {
  const palette = {
    mainColor: '#FFFFFF',
    colors: [],
  };

  if (fileName && !fileName.includes('svg')) {
    try {
      const mainColor = await ColorThief.getColor(path.join(__dirname, '..', TMP_FOLDER, fileName), PALETTE_PIXEL_SKIP);
      const mainColorHEX = `#${convert.rgb.hex(...mainColor)}`;
      palette.mainColor = mainColorHEX;
    } catch (err) {
      debug(`Error during getting main  color  from ${fileName}`, err.message || err.stack);
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
  } else {
    const paletteColors = getColors(path.join(__dirname, '..', TMP_FOLDER, fileName));
    const paletteColorsHex = [...new Set(paletteColors.fills.map((color) => color.hex()))];
    palette.mainColor = paletteColorsHex[0];
    palette.colors = paletteColorsHex;
  }

  return palette;
};

const rgbArrayToHex = (colors) => {
  const rgbColorsArray = colors.map((color) =>
    color
      .replace(/rgba|rgb|\(|\)|\s/gi, '')
      .split(',')
      .map(parseFloat)
  );
  return [...new Set(rgbColorsArray.map((el) => `#${convert.rgb.hex(...el)}`))];
};

async function getPageImagesPalettes(images = []) {
  const palettes = [];
  const filteredImages = images.filter((imageObject) => imageObject && !imageObject.url.endsWith('.ico'));
  for (const image of filteredImages) {
    if (!image.data) {
      const { safeFileName, fileName } = await saveImage(image.url);
      if (safeFileName) {
        const imagePalette = await getPalette(safeFileName);
        //    imagePalette && (await savePalette(imagePalette, safeFileName));
        palettes.push({
          safeFileName,
          fileName,
          palette: imagePalette,
          type: image.type,
        });
      }
    } else {
      const { safeFileName, fileName } = await saveSVGData(image.url);
      if (safeFileName) {
        const imagePalette = await getPalette(safeFileName);
        //    imagePalette && (await savePalette(imagePalette, safeFileName));
        palettes.push({
          safeFileName,
          fileName,
          palette: imagePalette,
          type: image.type,
        });
      }
    }
  }
  return palettes;
}

module.exports = {
  getPageImagesPalettes,
  rgbArrayToHex,
  getPalette,
  savePalette,
  getPalettesFromTags,
};
