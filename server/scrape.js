const debug = require('debug')('scrape');
const rimraf = require('rimraf');
const path = require('path');
const { v4: uuid } = require('uuid');
const { get } = require('lodash');
const { scrapePage, processScrapedLogos, getBestLogo, getBestIcon, adjustWeights } = require('./utils/logoSearch');
const { composePalette } = require('./utils/paletteComposer');
const {
  init,
  injectCodeIntoPage,
  closeBrowser,
  removeOverlays,
  removeImages,
  getPropsBySelector,
} = require('./utils/headlessScraper');
const {
  getPageImagesPalettes,
  getPalette,
  savePalette,
  getPalettesFromTags,
  getUniqueButtonsColors,
} = require('./utils/colors');

const {
  PALETTES_FOLDER,
  TMP_FOLDER,
  SELECTORS,
  MAKE_FULL_SCREENSHOT,
  LOGO_BACKGROUND_PALETTE_MAX_COLORS,
} = require('./constants');

async function getScreenshotPalette(page, options) {
  const palettes = [];
  const fileName = `screenshot_${uuid()}.png`;
  await page.screenshot({
    type: 'png',
    path: path.join(__dirname, TMP_FOLDER, fileName),
    fullPage: MAKE_FULL_SCREENSHOT,
    ...options,
  });

  if (fileName) {
    const screenshotPalette = await getPalette(fileName, LOGO_BACKGROUND_PALETTE_MAX_COLORS);
    if (screenshotPalette) {
      await savePalette(screenshotPalette, fileName);
      const customClipping = get(options, 'clip.custom', false);
      palettes.push({
        fileName,
        palette: screenshotPalette,
        customClipping,
      });
    }
  }
  return palettes;
}

async function scrape(url) {
  //await new Promise((resolve) => rimraf(path.join(__dirname, TMP_FOLDER, '*'), resolve));
  //await new Promise((resolve) => rimraf(path.join(__dirname, PALETTES_FOLDER, '*'), resolve));
  debug('scraping page ', url);
  const { page, browser } = await init({ url });

  setTimeout(() => {
    browser && closeBrowser(browser);
  }, 60000);
  /*
   * extracting html  content from page
   *  const pageHtml = await injectCodeIntoPage(page, extractInnerHtml);
   *  scraping the tags that could be our logo
   * const ls = new LogoSearch(page, url);
   */
  const logos = processScrapedLogos(await injectCodeIntoPage(page, scrapePage), url);
  const logoPalettes = adjustWeights(await getPageImagesPalettes(logos));
  // removing unneeeded elements from page

  const buttonColors = await injectCodeIntoPage(
    page,
    getPropsBySelector,
    SELECTORS.buttons.selectors,
    SELECTORS.buttons.properties
  );

  const linksColors = await injectCodeIntoPage(
    page,
    getPropsBySelector,
    SELECTORS.links.selectors,
    SELECTORS.links.properties
  );

  const uniquebuttonColors = getUniqueButtonsColors(buttonColors);
  const uniqueLinksColors = getUniqueButtonsColors(linksColors);
  const buttonsPalettes = getPalettesFromTags(uniquebuttonColors, 'buttons');
  const linkPalettes = getPalettesFromTags(uniqueLinksColors, 'links');
  const bestlogo = getBestLogo(logoPalettes);
  const bestIcon = getBestIcon(logoPalettes);
  const suggestedLogos = [];

  let screenshotPalettes = [];
  let cleanScreenshotPalettes = [];
  let clip = { x: 0, y: 0, width: 1920, height: 300 };
  if (bestlogo && bestlogo.boundingRect && bestlogo.boundingRect.isVisible) {
    const { boundingRect } = bestlogo;
    clip = {
      x: boundingRect.x,
      y: boundingRect.y,
      width: boundingRect.width,
      height: boundingRect.height,
      custom: true,
    };
  }
  const fullScreenshotPalettes = await getScreenshotPalette(page);
  await injectCodeIntoPage(page, removeOverlays);

  screenshotPalettes = await getScreenshotPalette(page, {
    clip,
  });

  await injectCodeIntoPage(page, removeImages);
  cleanScreenshotPalettes = await getScreenshotPalette(page, {
    clip,
  });

  /*
  const cleanScreenshotPalettes = await getScreenshotPalette(page);
  const topPageSectionScreenshotPalettes = await getScreenshotPalette(page, {
    clip: { x: 0, y: 0, width: 1920, height: 300 },
  });*/

  await closeBrowser(browser);

  bestlogo && suggestedLogos.push({ ...bestlogo, type: 'logo' });
  bestIcon && suggestedLogos.push({ ...bestIcon, type: 'icon' });
  let suggestedPalette = [];
  try {
    suggestedPalette = composePalette(
      bestlogo || bestIcon,
      bestIcon || bestlogo,
      [...buttonsPalettes], //[...buttonsPalettes, ...linkPalettes],
      get(screenshotPalettes, '[0]'),
      get(cleanScreenshotPalettes, '[0]'),
      get(fullScreenshotPalettes, '[0]')
    );
  } catch (e) {
    debug(e);
  } finally {
    await closeBrowser(browser);
  }
  return {
    rawPalettes: [
      ...logoPalettes,
      ...screenshotPalettes,
      ...cleanScreenshotPalettes,
      ...fullScreenshotPalettes,
      ...buttonsPalettes,
      ...linkPalettes,
    ],
    suggestions: suggestedLogos,
    suggestedPalette,
    screenshotFileName: fullScreenshotPalettes[0].fileName,
  };
}

module.exports = { scrape };
