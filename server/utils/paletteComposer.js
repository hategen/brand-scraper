const debug = require('debug')('paletteComposer');
const color = require('color');
const { extname } = require('path');
const { get, minBy, maxBy, max, orderBy, mapKeys } = require('lodash');
const { deltaE94, getColorDiffStatus, getLuminosity, getPaletteMedianLuminocity } = require('./colors');
const { DELTAE94_DIFF_STATUS, BUTTON_BACKGROUND_MAX_LUMINOSITY, COLOR_DISTANCE_TRESHOLD } = require('../constants.js');

const paleteHasMainColor = (palette = {}) => palette.palette && palette.palette.mainColor;
const paleteHasColors = (palette = {}) => palette.palette.colors && palette.palette.colors.length;
const paletteComplete = (palette = {}) => paleteHasMainColor(palette) && paleteHasColors(palette);

/*
 *  magick 1.png -fuzz 4% -fill White -opaque White -fuzz 0 -fill Black +opaque White -precision 15 out.png
 * magick -precision 15 out.png  -format "%[fx:int(mean*w*h+0.5)]" info:
 */
const isSVGPalette = (palette) =>
  palette && (extname(palette.fileName) === '.svg' || extname(palette.safeFileName) === '.svg');

/*
 * gets potential brand color
 *   approach for getting barand color  or the color close to it is quite  simple
 *  getting the logo palette + icon palette and looking for the colors with less delta E distance
 *  assuming  that is  something those 2 share in common
 *  this color  can  be quite easy  to  get  from  adequate svg but in raster could be slightly  off
 */
const getBrandColor = (logoPalette, iconPalette) => {};

const getPaletteMainColor = (palette) => get(palette, 'palette.mainColor', []);
const getPaletteColors = (palette) => get(palette, 'palette.colors', []);

// gets palete list oif unique palette colors together  with  main  color
const getFllPaletteColors = (palette) => [...new Set([getPaletteMainColor(palette), ...getPaletteColors(palette)])];

const getButtonBackgroundColor = (buttonPalette) => get(buttonPalette, 'palette.colors[1]', '#000000');
const getButtonsWithMaxWeight = (buttonColors) => {
  const maxWeight = max(buttonColors.map((el) => el.weight));
  return buttonColors.filter((el) => el.weight === maxWeight);
};
const getMergedButtonBackgroundPalette = (buttonsPalettes = []) => {
  return buttonsPalettes.reduce(
    (acc, palette, idx) => {
      if (idx === 0) {
        acc.palette.mainColor = getButtonBackgroundColor(palette);
      }
      acc.palette.colors = [...new Set([...acc.palette.colors, getButtonBackgroundColor(palette)])];
      return acc;
    },
    { palette: { mainColor: '#FFFFFF', colors: [] } }
  );
};
// gets most similar color pair  from 2 palettes
const mapToClosestColors = (paletteA = {}, paletteB = {}, comparator = deltaE94) => {
  const paletteAColors = getFllPaletteColors(paletteA);
  const paletteBColors = getFllPaletteColors(paletteB);

  const colorDistanceArray = paletteAColors.map((paletteAColor) => {
    const closestPaletteBColor = minBy(
      paletteBColors.map((paletteBColor) => ({
        paletteAColor,
        paletteBColor,
        comparingParam: comparator(paletteAColor, paletteBColor),
      })),
      'comparingParam'
    );

    return {
      ...closestPaletteBColor,
    };
  });

  return orderBy(colorDistanceArray, ['comparingParam'], ['asc']);
};

// gets most distinct color pair  from 2 palettes
const mapToFurthestColors = (paletteA = {}, paletteB = {}, comparator = deltaE94) => {
  const paletteAColors = getFllPaletteColors(paletteA);
  const paletteBColors = getFllPaletteColors(paletteB);

  const colorDistanceArray = paletteAColors.map((paletteAColor) => {
    const closestPaletteBColor = maxBy(
      paletteBColors.map((paletteBColor) => ({
        paletteAColor,
        paletteBColor,
        comparingParam: comparator(paletteAColor, paletteBColor),
      })),
      'comparingParam'
    );

    return {
      ...closestPaletteBColor,
    };
  });

  return orderBy(colorDistanceArray, ['comparingParam'], ['desc']);
};

// getting array of button colors with top weights And filtering out too light colors
const getButtonbackgroundColors = (buttonsPalettes = []) => {
  const buttonColors = orderBy(
    Object.entries(
      buttonsPalettes.reduce((acc, buttonPalette) => {
        const buttonBackgroundColor = getButtonBackgroundColor(buttonPalette);
        if (getLuminosity(buttonBackgroundColor) < BUTTON_BACKGROUND_MAX_LUMINOSITY) {
          acc[buttonBackgroundColor] = (acc[buttonBackgroundColor] || 0) + buttonPalette.weight;
        }
        return acc;
      }, {})
    ).map((el) => ({ color: el[0], weight: el[1] })),
    ['weight'],
    ['desc']
  );
  return buttonColors;
};

const getTopButtonColor = () => {};

const composePalette_OLD = (
  logoPalette,
  iconPalette,
  buttonsPalettes = [],
  logoAreaScreenshotPalette,
  logoAreaScreenshotPaletteWithoutBackground
) => {
  let brandColor;
  let mainColor;
  let secondaryColor;
  let backgroundColor;
  // 1. try main Colors from logo and  icon and match against button palettes

  const buttonColors = buttonsPalettes
    .map((el) => ({
      weight: el.weight,
      buttonBackgroundColor: get(el, 'palette.colors[1]'),
      buttonTextColor: get(el, 'palette.colors[0]'),
      buttonBackgroundColorLuminosity: getLuminosity(get(el, 'palette.colors[1]')),
      buttonTextColorLuminosity: getLuminosity(get(el, 'palette.colors[0]')),
      buttonColorisDark: color(get(el, 'palette.colors[1]')).isDark(),
    }))
    .filter((el) => el.buttonBackgroundColorLuminosity < BUTTON_BACKGROUND_MAX_LUMINOSITY);

  if (paletteComplete(logoPalette) && paletteComplete(iconPalette)) {
    const logoColors = get(logoPalette, 'palette.colors');
    const logoMainColor = get(logoPalette, 'palette.mainColor');
    const iconColors = get(iconPalette, 'palette.colors');
    const iconMainColor = get(iconPalette, 'palette.mainColor');

    // checking logo  colors  against  icon colors  and grabbing ones with less distance
    const colorDistanceArray = logoColors.map((lc) => {
      const closestLogoIconColor = minBy(
        iconColors.map((ic) => ({
          logoColor: lc,
          iconColor: ic,
          logoToIconColorDistance: deltaE94(lc, ic),
          logoColorIsDark: color(lc).isDark(),
        })),
        'logoToIconColorDistance'
      );

      return {
        ...closestLogoIconColor,
        logoToLogoMainColorDistance: deltaE94(closestLogoIconColor.logoColor, logoMainColor),
      };
    });
    let buttonColorsArray;
    if (buttonColors) {
      buttonColorsArray = buttonColors.map((bc) =>
        minBy(
          colorDistanceArray.map((cd) => ({
            ...cd,
            ...bc,
            logoToButtonBackgroundColorDistance: deltaE94(cd.logoColor, bc.buttonBackgroundColor),
          })),
          'logoToButtonBackgroundColorDistance'
        )
      );
    }

    debug('DeltaArray', colorDistanceArray);
    debug('ButtonColorsArray', buttonColorsArray);
    // filter out colors that are the closest  to  button  color
    let potentialBrandColors = buttonColorsArray.filter(
      (el) => el.logoToButtonBackgroundColorDistance <= COLOR_DISTANCE_TRESHOLD
    );
    debug('PotentialBrandColors', potentialBrandColors);

    // if more than one take the one with max weigth
    if (potentialBrandColors.length > 1) {
      const maxWeight = max(potentialBrandColors.map((el) => el.weight));
      potentialBrandColors = potentialBrandColors.filter((el) => el.weight === maxWeight);
    }

    debug('PotentialBrandColors wit h max weight', potentialBrandColors);
    let potentialBrandColor = potentialBrandColors[0];
    // refine to the one with  max icon similarity
    if (potentialBrandColors.length > 1) {
      potentialBrandColor = minBy(potentialBrandColors, 'logoToIconColorDistance');
    }

    let brandColorIsDark = true;
    if (potentialBrandColor) {
      mainColor = potentialBrandColor.buttonBackgroundColor;
      brandColorIsDark = color(potentialBrandColor.buttonBackgroundColor).isDark();
    } else if (buttonColorsArray.length) {
      mainColor = maxBy(buttonColorsArray, 'weight').buttonBackgroundColor;
    } else {
      mainColor = logoMainColor;
    }

    secondaryColor = maxBy(
      colorDistanceArray.map((el) => ({ ...el, mainColorToLogoColorDistance: deltaE94(el.logoColor, mainColor) })),
      'mainColorToLogoColorDistance'
    ).logoColor;

    if (!secondaryColor || mainColor === secondaryColor) {
      secondaryColor = color(mainColor).desaturate(0.5).darken(3).fade(0.2).hex();
    }

    const logoMeanLuminace = getPaletteMedianLuminocity([logoMainColor, ...logoColors]);
    // if (brandColorIsDark && logoMeanLuminace < 0.5) {
    backgroundColor = color(secondaryColor).desaturate(0.7).lighten(3).fade(0.7).hex();
    // }
  }
  debug('XXXX', mainColor, secondaryColor, backgroundColor);

  return [mainColor, secondaryColor, backgroundColor || '#fafafa'];
};

const composePalette = (
  logoPalette,
  iconPalette,
  buttonsPalettes = [],
  logoAreaScreenshotPalette,
  logoAreaScreenshotPaletteWithoutBackground,
  fullScreenshotPalette
) => {
  let brandColor;
  let mainColor;
  let secondaryColor;
  let backgroundColor;

  /*
   * potential brand colors = > the ones that match  in  logo and icon
   * should be taken carefully  if  super dark or super light
   */
  const logoToIconMatches = mapToClosestColors(logoPalette, iconPalette);
  debug('Color distance array', logoToIconMatches);
  const closestLogoToIconColor = minBy(logoToIconMatches, 'comparingParam').paletteAColor;
  // color distinction within logo could be usefull to  find 2 most contrast colors in logo
  const logoSelfDistinctColors = mapToFurthestColors(logoPalette, logoPalette);
  debug('Logo Color distance array', logoSelfDistinctColors);

  // button colors ordered by priority
  const buttonColors = getButtonbackgroundColors(buttonsPalettes);
  const mergedButtonBackgroundPalette = getMergedButtonBackgroundPalette(buttonsPalettes);
  const buttonColorsWithMaxWeight = debug('TopButton palettes', buttonColors);

  const cleanBackgroundColor = getPaletteMainColor(logoAreaScreenshotPaletteWithoutBackground);
  const dominantLogoScreenshotColor = getPaletteMainColor(logoAreaScreenshotPalette);

  if (buttonColors.length && logoPalette && iconPalette) {
    const buttonsWithMaxWeight = getButtonsWithMaxWeight(buttonColors);
    // if there is a tie  selecting color  that is closest to logo/icon
    if (buttonsWithMaxWeight.length > 1) {
      const closestButtonColors = mapToClosestColors(mergedButtonBackgroundPalette, logoPalette);
      mainColor = minBy(closestButtonColors, 'comparingParam').paletteAColor;
    } else {
      mainColor = maxBy(buttonColors, 'weight').color;
    }
  } else if (logoPalette && iconPalette) {
    mainColor = minBy(logoToIconMatches, 'comparingParam').paletteAColor;
  } else if (logoPalette) {
    mainColor = getPaletteMainColor(logoPalette);
  } else {
    mainColor = getPaletteMainColor(fullScreenshotPalette);
  }

  if (logoPalette) {
    const mostDistantLogoColorToMain = mapToFurthestColors(logoPalette, {
      palette: { mainColor, colors: [mainColor] },
    }).filter((el) => getLuminosity(el.paletteAColor) < BUTTON_BACKGROUND_MAX_LUMINOSITY);

    if (mostDistantLogoColorToMain.length) {
      secondaryColor = maxBy(mostDistantLogoColorToMain, 'comparingParam').paletteAColor;
    } else {
      secondaryColor = mainColor;
    }
  } else {
    secondaryColor = getPaletteMainColor(fullScreenshotPalette);
  }

  /*
   *  //main/secondary  colors too  similar  try to  check  another one
   *  if (deltaE94(mainColor, secondaryColor) < COLOR_DISTANCE_TRESHOLD) {
   *  let mostDistantLogoColors = maxBy(logoSelfDistinctColors, 'comparingParam');
   *  const ditinctColorsArray = [mostDistantLogoColors.paletteAColor, mostDistantLogoColors.paletteBColor];
   *  }
   */

  return [mainColor, secondaryColor, cleanBackgroundColor || '#fafafa'];
};

module.exports = { composePalette };
