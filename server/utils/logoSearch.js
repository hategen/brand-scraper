const debug = require('debug')('logoSearch');
const uniqBy = require('lodash/uniqBy');

const findJsonLdImages = (text) => {
  const info = JSON.parse(text);
  return info && info.logo && info.logo.url ? info.logo.url : null;
};
const svgToDataURL = (svgStr) => {
  if (svgStr && svgStr.indexOf('svg') && svgStr.indexOf('href') === -1) {
    const encoded = encodeURIComponent(svgStr).replace(/'/g, '%27').replace(/"/g, '%22');
    const header = 'data:image/svg+xml,';
    return header + encoded;
  } else {
    return null;
  }
};

const extractURL = (cssURl) => /(?:\(['"]?)(.*?)(?:['"]?\))/.exec(cssURl)[1];

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
  /*
   * const isValidUrl = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;
   * return isValidUrl.test(url);
   */
};

const scrapePage = () => {
  let headerSelectorPart = ``;
  if (document.querySelectorAll('header').length > 0) {
    headerSelectorPart = `header `;
  } else if (document.querySelectorAll('[class*="header"]').length > 0) {
    headerSelectorPart = `.${[...document.querySelectorAll('[class*="header"]')[0].classList].filter((x) =>
      x.toLowerCase().includes('header')
    )}`;
  }
  const scrapers = [
    () =>
      [...document.querySelectorAll(`meta[property="og:logo"]`)].map((el) => ({
        type: 'og:logo',
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[property="og:image"]`)].map((el) => ({
        type: 'og:image',
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[itemprop="logo"]`)].map((el) => ({
        type: 'meta-itemprop/logo',
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`link[rel*="icon"]`)].map((el) => ({
        type: 'link-rel/icon',
        url: el.getAttribute('href'),
        size: el.getAttribute('sizes'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[itemprop="logo"]`)].map((el) => ({
        type: 'img-itemprop/logo',
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`meta[name*="msapplication-TileImage"]`)].map((el) => ({
        type: 'meta-name/msapplication-TileImage',
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[content*="logo"]`)].map((el) => ({
        type: 'meta-content/logo',
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[itemprop*="image"]`)].map((el) => ({
        type: 'meta-content/image',
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`script[type*="application/ld+json"]`)].map((el) => ({
        type: 'json-ld-logo',
        url: el.innerHTML, // findJsonLdImages
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[alt*="logo"]`)].map((el) => ({
        type: 'img-alt/logo',
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[class*="logo"]`)].map((el) => ({
        type: 'img-alt/logo-class',
        url: el.getAttribute('src'),
      })),
/*    () =>
      [...document.querySelectorAll(`${headerSelectorPart} a[class*="logo"]`)].map((el) => ({
        type: 'svg:image',
        data: true,
        url: el.innerHTML, // svgToDataURL
      })),*/
    () =>
      [...document.querySelectorAll([`[class*="logo"] *`, `#logo *`, `header *`])]
        .map((el) => window.getComputedStyle(el).getPropertyValue(`background-image`))
        .filter((el) => el !== 'none')
        .map((el) => ({
          type: 'css:background-image',
          url: el, // extractURL
        })),
    () =>
      [
        ...document.querySelectorAll([
          `[aria-label*="home"] img`,
          `a[href="/"] img`,
          `[rel="home"] img`,
          `a[href="${location.origin}"] img`,
          `a[href="${location.origin}/"] img`,
        ]),
      ].map((el) => ({
        type: 'img-nested/logo-class',
        url: el.getAttribute('src'),
      })),
    () =>
      [
        ...document.querySelectorAll([
          `[aria-label*="home"] svg`,
          `a[href="/"] svg`,
          `[rel="home"] svg`,
          `a[href="${location.origin}"] svg`,
          `a[href="${location.origin}/"] svg`,
        ]),
      ].map((el) => ({
        type: 'svg:imageRaw',
        data: true,
        url: el.outerHTML, // svgToDataURL
      })),
  ];

  return scrapers.reduce((acc, scraperFunc) => {
    acc.push(...scraperFunc());
    return acc;
  }, []);
};

const logoProcessors = {
  'svg:image': svgToDataURL,
  'json-ld-logo': findJsonLdImages,
  'css:background-image': extractURL,
};

const processScrapedLogos = (logos, url) => {
  const parsedUrl = new URL(url);
  const host = `${parsedUrl.protocol}//${parsedUrl.host}`;

  const processedLogos = logos
    .map((logo) => {
      if (logoProcessors[logo.type] && typeof logoProcessors[logo.type] === 'function') {
        // eslint-disable-next-line no-param-reassign
        logo.url = logoProcessors[logo.type](logo.url);
      }
      return logo;
    })
    .filter((logo) => logo.url)
    .map((logo) => {
      if (logo.url && logo.url.startsWith('//')) {
        logo.url = `${parsedUrl.protocol}${logo.url}`;
      }
      return logo;
    });

  const correctLogos = uniqBy(
    processedLogos.map((image) =>
      !image.data && !isValidUrl(image.url) && image.url.indexOf('data:') === -1
        ? {
            ...image,
            url: `${host}${image.url}`,
          }
        : image
    ),
    'url'
  );

  debug(JSON.stringify(correctLogos, null, 2));
  return correctLogos;
};

module.exports = {
  scrapePage,
  processScrapedLogos,
};
