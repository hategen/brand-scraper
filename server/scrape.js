const debug = require('debug')('scrape');
const rimraf = require('rimraf');
const path = require('path');
const { v4: uuid } = require('uuid');
const { get } = require('lodash');
const { scrapePage, processScrapedLogos, getBestLogo, getBestIcon, adjustWeights } = require('./utils/logoSearch');
const { composePalette } = require('./utils/paletteComposer');
const { init, injectCodeIntoPage, closeBrowser, cleanPage, getPropsBySelector } = require('./utils/headlessScraper');
const {
  getPageImagesPalettes,
  getPalette,
  savePalette,
  getPalettesFromTags,
  getUniqueButtonsColors,
} = require('./utils/colors');

const { PALETTES_FOLDER, TMP_FOLDER, SELECTORS, MAKE_FULL_SCREENSHOT } = require('./constants');

async function getScreenshotPalette(page) {
  const palettes = [];
  const fileName = `screenshot_${uuid()}.png`;
  await page.screenshot({
    type: 'png',
    path: path.join(__dirname, TMP_FOLDER, fileName),
    fullPage: MAKE_FULL_SCREENSHOT,
  });

  if (fileName) {
    const screenshotPalette = await getPalette(fileName);
    if (screenshotPalette) {
      await savePalette(screenshotPalette, fileName);
      palettes.push({
        fileName,
        palette: screenshotPalette,
      });
    }
  }
  return palettes;
}

async function scrape(url) {
  await new Promise((resolve) => rimraf(path.join(__dirname, TMP_FOLDER, '*'), resolve));
  await new Promise((resolve) => rimraf(path.join(__dirname, PALETTES_FOLDER, '*'), resolve));

  const { page, browser } = await init({ url });
  /*
   * extracting html  content from page
   *  const pageHtml = await injectCodeIntoPage(page, extractInnerHtml);
   *  scraping the tags that could be our logo
   * const ls = new LogoSearch(page, url);
   */
  const logos = processScrapedLogos(await injectCodeIntoPage(page, scrapePage), url);
  const logoPalettes = adjustWeights(await getPageImagesPalettes(logos));
  // removing unneeeded elements from page

  const screenshotPalettes = await getScreenshotPalette(page);
  await injectCodeIntoPage(page, cleanPage);
  const cleanScreenshotPalettes = await getScreenshotPalette(page);

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
  await closeBrowser(browser);

  const bestlogo = getBestLogo(logoPalettes);
  const bestIcon = getBestIcon(logoPalettes);

  const suggestedLogos = [];

  bestlogo && suggestedLogos.push(bestlogo);
  bestIcon && suggestedLogos.push(bestIcon);
  let suggestedPalette = [];
  try {
    suggestedPalette = composePalette(
      bestlogo || bestIcon,
      bestIcon,
      [...buttonsPalettes, ...linkPalettes],
      get(screenshotPalettes, [0])
    );
  } catch (e) {
    debug(e);
  }
  return {
    rawPalettes: [...logoPalettes, ...screenshotPalettes, ...cleanScreenshotPalettes, ...buttonsPalettes],
    suggestions: suggestedLogos,
    suggestedPalette,
  };
}

module.exports = { scrape };
