const puppeteer = require('puppeteer');
const debug = require('debug')('headlessScraper');

const { DEFAULT_VIEWPORT, DEFAULT_PAGE_WAIT_TIMEOUT, OVERRIDE_USER_AGENT, USER_AGENT } = require('../constants');

const openBrowser = async () => {
  debug('Browser open START');
  const browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true });
  debug('Browser open END');
  return browser;
};

const closeBrowser = async (browser) => {
  debug('Browser close START');
  await browser.close();
  debug('Browser close END');
};

const openPage = async (browser, config) => {
  const page = await browser.newPage();

  const { url, viewport = DEFAULT_VIEWPORT, waitTimeout = DEFAULT_PAGE_WAIT_TIMEOUT } = config;
  page.on('error', (err) => {
    debug('error happen at the page: ', url, err);
  });

  page.on('pageerror', (pageerr) => {
    debug('pageerror occurred: ', url, pageerr);
  });

  page.setViewport(viewport);
  await Promise.all([
    page.goto(url),
    page.waitForNavigation({
      waitUntil: ['load'],
    }),
  ]);

  await page.waitFor(500);

  return page;
};

const init = async function (config) {
  let browser;
  try {
    browser = await openBrowser();
    const page = await openPage(browser, config);
    if (OVERRIDE_USER_AGENT) {
      await page.setUserAgent(USER_AGENT);
    }
    return {
      page,
      browser,
    };
  } catch (e) {
    if (browser) {
      await closeBrowser(browser);
    }

    throw e;
  }
};

const injectCodeIntoPage = async function (page, injectableFunc, ...injectableFuncArgs) {
  try {
    debug('Evaluating ', injectableFunc.name);
    const data = await page.evaluate(injectableFunc, ...injectableFuncArgs);
    return data;
  } catch (e) {
    debug('Injected function evaluation error at', injectableFunc.name, e);
  }
};

const removeOverlays = () => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const allElements = document.getElementsByTagName('*');

  for (let i = 0, { length } = allElements; i < length; i++) {
    try {
      const style = window.getComputedStyle(allElements[i]);
      const elementWidth = Math.round(style.getPropertyValue('width').replace('px', ''));
      const elementHeight = Math.round(style.getPropertyValue('height').replace('px', ''));
      if (
        style.getPropertyValue('position') === 'fixed' &&
        elementWidth === viewportWidth &&
        elementHeight === viewportHeight
      ) {
        allElements[i].parentNode.removeChild(allElements[i]);
      }
    } catch (err) {
      console.error('removeOverlays', err);
    }
  }
};

const removeImages = () => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  document.head.insertAdjacentHTML(
    'beforeend',
    `<style>img{visibility:hidden!important} svg{visibility:hidden!important} video{visibility:hidden!important};</style>`
  );

  /*  document.querySelectorAll('img,svg,video').forEach((el) => {
    // el.parentNode.removeChild(el);
    el.style.visibility = 'hidden';
  });*/

  const allElements = document.getElementsByTagName('*');

  for (let i = 0, { length } = allElements; i < length; i++) {
    try {
      const style = window.getComputedStyle(allElements[i]);
      if (style.background.includes('url') || style.backgroundImage) {
        allElements[i].style.backgroundImage = 'none';
      }
      const elementWidth = Math.round(style.getPropertyValue('width').replace('px', ''));
      const elementHeight = Math.round(style.getPropertyValue('height').replace('px', ''));
      if (
        style.getPropertyValue('position') === 'fixed' &&
        elementWidth === viewportWidth &&
        elementHeight === viewportHeight
      ) {
        allElements[i].parentNode.removeChild(allElements[i]);
      }
    } catch (e) {
      console.error('removeImages', e);
    }
  }
};

const getPropsBySelector = (selectors, properties) => {
  const colors = [];

  selectors.forEach((selector) => {
    const elements = [...document.querySelectorAll(selector)];
    elements.forEach((el) => {
      //   el.focus();
      const computedStyle = window.getComputedStyle(el);
      const elementColors = {};
      properties.forEach((property) => {
        const value = computedStyle.getPropertyValue(property);
        elementColors[property] = value;
      });

      if (elementColors['background-color'] !== `rgba(0, 0, 0, 0)`) {
        colors.push(elementColors);
      }
    });
  });

  return colors;
};

module.exports = {
  init,
  injectCodeIntoPage,
  closeBrowser,
  removeImages,
  removeOverlays,
  getPropsBySelector,
};
