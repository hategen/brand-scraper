const path = require('path');
const puppeteer = require('puppeteer');
const debug = require('debug')('headlessScraper');
const { DEFAULT_VIEWPORT, DEFAULT_PAGE_WAIT_TIMEOUT } = require('../constants');

const openBrowser = async () => {
  debug('Browser open START');
  const browser = await puppeteer.launch();
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
    debug('error happen at the page: ', err);
  });

  page.on('pageerror', (pageerr) => {
    debug('pageerror occurred: ', pageerr);
  });

  page.setViewport(viewport);
  await page.goto(url);
  await page.waitFor(waitTimeout);

  return page;
};

const init = async function (config) {
  const browser = await openBrowser();
  const page = await openPage(browser, config);
  return { page, browser };
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

const extractInnerHtml = () => {
  return document.documentElement.innerHTML;
};

const cleanPage = () => {
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
};

const getPropsBySelector = (selectors, properties) => {
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
};

module.exports = {
  init,
  injectCodeIntoPage,
  extractInnerHtml,
  closeBrowser,
  cleanPage,
  getPropsBySelector,
};
