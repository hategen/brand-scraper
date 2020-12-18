const debug = require('debug')('logoSearch');
const orderBy = require('lodash/orderBy');
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
        priority: 3,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[itemprop="logo"]`)].map((el) => ({
        type: 'meta-itemprop/logo',
        priority: 3,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`link[rel*="icon"]`)].map((el) => ({
        type: 'link-rel/icon',
        priority: 4,
        url: el.getAttribute('href'),
        size: el.getAttribute('sizes'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[itemprop="logo"]`)].map((el) => ({
        type: 'img-itemprop/logo',
        priority: 4,
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`meta[name*="msapplication-TileImage"]`)].map((el) => ({
        type: 'meta-name/msapplication-TileImage',
        priority: 4,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[content*="logo"]`)].map((el) => ({
        type: 'meta-content/logo',
        priority: 4,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[itemprop*="image"]`)].map((el) => ({
        type: 'meta-content/image',
        priority: 4,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`script[type*="application/ld+json"]`)].map((el) => ({
        type: 'json-ld-logo',
        url: el.innerHTML, // findJsonLdImages
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[alt*="logo"]`)].map((el) => ({
        priority: 5,
        type: 'img-alt/logo',
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[class*="logo"]`)].map((el) => ({
        priority: 4,
        type: 'img-alt/logo-class',
        url: el.getAttribute('src'),
      })),
    /*    () =>
      [...document.querySelectorAll(`${headerSelectorPart} a[class*="logo"]`)].map((el) => ({
        type: 'svg:image',
        data: true,
        url: el.innerHTML, // svgToDataURL seems to be useless
      })),*/
    () =>
      [...document.querySelectorAll([`[class*="logo"] *`, `#logo *`])]
        .map((el) => window.getComputedStyle(el).getPropertyValue(`background-image`))
        .filter((el) => el !== 'none')
        .map((el) => ({
          priority: 4,
          type: 'css:background-image',
          url: el, // extractURL
        })),
    () =>
      [
        ...document.querySelectorAll([
          `[aria-label*="home"] *`,
          `a[href="/"] *`,
          `[rel="home"] *`,
          `a[href="${location.origin}"] *`,
          `a[href="${location.origin}/"] *`,
        ]),
      ]
        .map((el) => window.getComputedStyle(el).getPropertyValue(`background-image`))
        .filter((el) => el !== 'none')
        .map((el) => ({
          priority: 3,
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
          `a[href="${location.href}"] img`,
        ]),
      ].map((el) => ({
        priority: 2,
        type: 'img-nested/home-leading',
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
          `a[href="${location.href}"] svg`,
        ]),
      ].map((el) => {
        el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return {
          priority: 1,
          type: 'img-nested/home-leading-svg',
          data: true,
          url: el.outerHTML, // svgToDataURL
        };
      }),
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

      if (logo.type !== 'img-nested/home-leading-svg' && logo.url.endsWith('.svg')) {
        logo.priority = logo.priority - 1;
      }

      return logo;
    });

  const correctLogos = orderBy(
    processedLogos.map((image) =>
      !image.data && !isValidUrl(image.url) && image.url.indexOf('data:') === -1
        ? {
            ...image,
            url: host.endsWith('/') || image.url.startsWith('/') ? `${host}${image.url}` : `${host}/${image.url}`,
          }
        : image
    ),
    ['priority'],
    ['asc']
  );

  debug(JSON.stringify(correctLogos, null, 2));
  return correctLogos;
};

module.exports = {
  scrapePage,
  processScrapedLogos,
};
