const rimraf = require('rimraf');
const path = require('path');
const { uniqWith, isEqual } = require('lodash');

const { scrapePage, processScrapedLogos } = require('./utils/logoSearch');
const { init, injectCodeIntoPage, closeBrowser, cleanPage, getPropsBySelector } = require('./utils/headlessScraper');
const { getPageImagesPalettes, getPalette, savePalette, getPalettesFromTags } = require('./utils/colors');

const { PALETTES_FOLDER, TMP_FOLDER, SELECTORS, MAKE_FULL_SCREENSHOT } = require('./constants');

async function getScreenshotPalette(page) {
  const palettes = [];
  const fileName = `screenshot.png`;
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
  const logoPalettes = await getPageImagesPalettes(logos);

  // removing unneeeded elements from page
  await injectCodeIntoPage(page, cleanPage);
  const screenshotPalettes = await getScreenshotPalette(page);

  const buttonColors = await injectCodeIntoPage(
    page,
    getPropsBySelector,
    SELECTORS.buttons.selectors,
    SELECTORS.buttons.properties
  );

  const uniquebuttonColors = uniqWith(buttonColors, isEqual);

  uniquebuttonColors.forEach((el) => {
    const count = buttonColors.filter((nuel) => isEqual(nuel, el)).length;
    el.weight = count;
  });
  const buttonsPalettes = getPalettesFromTags(uniquebuttonColors, 'buttons');
  await closeBrowser(browser);
  return [...logoPalettes, ...screenshotPalettes, ...buttonsPalettes];
}

module.exports = { scrape };
