const debug = require('debug')('paletteComposer');
const color = require('color');
const { extname } = require('path');
const { deltaE94, getColorDiffStatus, getLuminosity } = require('./colors');
const { DELTAE94_DIFF_STATUS, BUTTON_BACKGROUND_MAX_LUMINOSITY, COLOR_DISTANCE_TRESHOLD } = require('../constants.js');

const { get, minBy, maxBy, max } = require('lodash');

const paleteHasMainColor = (palette = {}) => palette.palette && palette.palette.mainColor;
const paleteHasColors = (palette = {}) => palette.palette.colors && palette.palette.colors.length;
const paletteComplete = (palette = {}) => paleteHasMainColor(palette) && paleteHasColors(palette);

const isSVGPalette = (palette) =>
  palette && (extname(palette.fileName) === '.svg' || extname(palette.safeFileName) === '.svg');

const composePalette = (logoPalette, iconPalette, buttonsPalettes = [], screenshotPalette) => {
  let brandColor;
  let mainColor;
  let secondaryColor;
  let backgroundColor;
  // 1. try main Colors from logo and  icon and match against button palettes

  const buttonColors = buttonsPalettes
    .map((el) => {
      return {
        weight: el.weight,
        buttonBackgroundColor: get(el, 'palette.colors[1]'),
        buttonTextColor: get(el, 'palette.colors[0]'),
        buttonBackgroundColorLuminosity: getLuminosity(get(el, 'palette.colors[1]')),
        buttonTextColorLuminosity: getLuminosity(get(el, 'palette.colors[0]')),
        buttonColorisDark: color(get(el, 'palette.colors[1]')).isDark(),
      };
    })
    .filter((el) => el.buttonBackgroundColorLuminosity < BUTTON_BACKGROUND_MAX_LUMINOSITY);

  if (paletteComplete(logoPalette) && paletteComplete(iconPalette)) {
    const logoColors = get(logoPalette, 'palette.colors');
    const logoMainColor = get(logoPalette, 'palette.mainColor');
    const iconColors = get(iconPalette, 'palette.colors');
    const iconMainColor = get(iconPalette, 'palette.mainColor');

    //checking logo  colors  against  icon colors  and grabbing ones with less distance
    let colorDistanceArray = logoColors.map((lc) => {
      const closestLogoIconColor = minBy(
        iconColors.map((ic) => {
          return {
            logoColor: lc,
            iconColor: ic,
            logoToIconColorDistance: deltaE94(lc, ic),
            logoColorIsDark: color(lc).isDark(),
          };
        }),
        'logoToIconColorDistance'
      );

      return {
        ...closestLogoIconColor,
        logoToLogoMainColorDistance: deltaE94(closestLogoIconColor.logoColor, logoMainColor),
      };
    });
    let buttonColorsArray;
    if (buttonColors) {
      buttonColorsArray = buttonColors.map((bc) => {
        return minBy(
          colorDistanceArray.map((cd) => {
            return {
              ...cd,
              ...bc,
              logoToButtonBackgroundColorDistance: deltaE94(cd.logoColor, bc.buttonBackgroundColor),
            };
          }),
          'logoToButtonBackgroundColorDistance'
        );
      });
    }

    debug('DeltaArray', colorDistanceArray);
    debug('ButtonColorsArray', buttonColorsArray);
    // filter out colors that are the closest  to  button  color
    let potentialBrandColors = buttonColorsArray.filter(
      (el) => el.logoToButtonBackgroundColorDistance <= COLOR_DISTANCE_TRESHOLD
    );
    debug('PotentialBrandColors', potentialBrandColors);

    //if more than one take the one with max weigth
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

    const brandColorIsDark = color(potentialBrandColor.buttonBackgroundColor).isDark();
    mainColor = potentialBrandColor.buttonBackgroundColor;
    //dark buttons -> lighter background

    if (brandColorIsDark && color(logoMainColor).isDark() ) {
      backgroundColor = 1;
    }

    debug('PotentialBrandColors wit best icon similarity', potentialBrandColor);
  }

  return {
    logoPalette,
    iconPalette,
    mainColor,
    secondaryColor,
    backgroundColor,
  };
};

module.exports = { composePalette };
