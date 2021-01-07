const debug = require('debug')('logoSearch');
const { orderBy, uniqBy, minBy, get } = require('lodash');
const { LOGO_TYPES, ICON_TYPES, DEFAULT_VIEWPORT } = require('../constants');

const { getPaletteDistributionScore, getLuminosity } = require('./colors');

const findJsonLdImages = (text) => {
  try {
    const info = JSON.parse(text);

    if (info && info.logo && info.logo.url) {
      return info.logo.url;
    } else if (info && info.logo) {
      return info.logo;
    }
  } catch (e) {
    debug('ERROR parsing json logo', e);
  }
  return null;
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

const getBestLogo = (logoPalettes = []) => {
  const logos = logoPalettes.filter((palette) => LOGO_TYPES.includes(palette.type));
  const minPriority = get(minBy(logos, 'priority'), 'priority');

  const minRatingLogos = logos.filter((logo) => logo.priority === minPriority);
  // trying to get logo with max rating  that is visible on the initial screen
  const bestLogos = minRatingLogos.filter((el) => el.boundingRect && el.boundingRect.isVisible);

  if (bestLogos.length) {
    return bestLogos[0];
  }

  return minRatingLogos[0];
};

const getBestIcon = (logoPalettes = []) => {
  const logos = logoPalettes.filter((palette) => ICON_TYPES.includes(palette.type));
  const minPriority = get(minBy(logos, 'priority'), 'priority');

  const minRatingLogos = logos.filter((logo) => logo.priority === minPriority);

  /*
   * const d = minRatingLogos.map((e) => e.palette.colors).map((el) => getPaletteDistributionScore(el, getLuminosity));
   * just get first one now
   */
  return minRatingLogos[0];
};

const extractURL = (cssURl) => /(?:\(['"]?)(.*?)(?:['"]?\))/.exec(cssURl)[1];

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};
const scrapePage = () => {
  function isElementInViewport(rect) {
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  // getting bounding rect for the image.
  const getBoundingClientRect = (el) => {
    if (el.getBoundingClientRect) {
      const boundingRect = JSON.parse(JSON.stringify(el.getBoundingClientRect()));

      if (Object.values(boundingRect).filter((el) => el !== 0).length > 0) {
        return { ...boundingRect, isVisible: isElementInViewport(boundingRect) };
      }
    }
    return null;
  };
  // do  not  do that at home  need a better way of getting  imported svg
  const checkSVGuse = (el) => {
    const useTag = el.querySelector('use');
    if (useTag) {
      const useHref = useTag.getAttribute('href') || useTag.getAttribute('xlink:href');
      useTag.removeAttribute('xlink:href');
      useTag.setAttribute('href', useHref);
      const svgShadowContainerNode = document.querySelector(`svg ${useHref}`).parentNode;
      if (svgShadowContainerNode) {
        const svgShadowContainerNodeContent = svgShadowContainerNode.innerHTML;
        el.innerHTML = svgShadowContainerNodeContent + el.innerHTML;
      }
    }
    // inline svg styles
    el.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      const fill = style.getPropertyValue('fill');
      const stroke = style.getPropertyValue('stroke');
      if (fill !== 'none') {
        el.setAttribute('fill', fill);
      }
      if (fill !== 'none') {
        el.setAttribute('stroke', stroke);
      }
    });

    return el.outerHTML;
  };

  let headerSelectorPart = ``;
  if (document.querySelectorAll('header').length > 0) {
    headerSelectorPart = `header `;
  } else if (document.querySelectorAll('[class*="header"]').length > 0) {
    headerSelectorPart = `.${[...document.querySelectorAll('[class*="header"]')[0].classList].filter((x) =>
      x.toLowerCase().includes('header')
    )}`;
  } else if (document.querySelectorAll('[id*="header"]').length > 0) {
    headerSelectorPart = `#${[...document.querySelectorAll('[id*="header"]')][0].getAttribute('id')}`;
  }
  const scrapers = [
    () =>
      [...document.querySelectorAll(`meta[property="og:logo"]`)].map((el) => ({
        type: 'og:logo',
        boundingRect: getBoundingClientRect(el),
        priority: 3,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[itemprop="logo"]`)].map((el) => ({
        type: 'meta-itemprop/logo',
        boundingRect: getBoundingClientRect(el),
        priority: 3,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`link[rel*="icon"]`)].map((el) => ({
        type: 'link-rel/icon',
        boundingRect: getBoundingClientRect(el),
        priority: 4,
        url: el.getAttribute('href'),
        size: el.getAttribute('sizes'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[itemprop="logo"]`)].map((el) => ({
        type: 'img-itemprop/logo',
        boundingRect: getBoundingClientRect(el),
        priority: 4,
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`meta[name*="msapplication-TileImage"]`)].map((el) => ({
        type: 'meta-name/msapplication-TileImage',
        boundingRect: getBoundingClientRect(el),
        priority: 4,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[content*="logo"]`)].map((el) => ({
        type: 'meta-content/logo',
        boundingRect: getBoundingClientRect(el),
        priority: 3,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`meta[itemprop*="image"]`)].map((el) => ({
        type: 'meta-content/image',
        boundingRect: getBoundingClientRect(el),
        priority: 4,
        url: el.getAttribute('content'),
      })),
    () =>
      [...document.querySelectorAll(`script[type*="application/ld+json"]`)].map((el) => ({
        type: 'json-ld-logo',
        boundingRect: getBoundingClientRect(el),
        url: el.innerHTML, // findJsonLdImages
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[alt*="logo"]`)].map((el) => ({
        priority: 3,
        type: 'img-alt/logo',
        boundingRect: getBoundingClientRect(el),
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[class*="logo"]`)].map((el) => ({
        priority: 3,
        type: 'img-alt/logo-class',
        boundingRect: getBoundingClientRect(el),
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll(`${headerSelectorPart} img[src*="logo"]`)].map((el) => ({
        priority: 3,
        type: 'img-src/logo-class',
        boundingRect: getBoundingClientRect(el),
        url: el.getAttribute('src'),
      })),
    () =>
      [...document.querySelectorAll([`[class*="logo"] *`, `#logo *`])]
        .map((el) => window.getComputedStyle(el).getPropertyValue(`background-image`))
        .filter((el) => el !== 'none')
        .map((el) => ({
          priority: 4,
          type: 'css:background-image',
          boundingRect: getBoundingClientRect(el),
          url: el, // extractURL
        })),
    () =>
      [
        ...document.querySelectorAll([
          `#logo *`,
          `[aria-label*="home"] *`,
          `a[href="/"] *`,
          `a[href="/home"] *`,
          `[rel="home"] *`,
          `a[href="#/"] *`,
          `a[href="${location.origin}"] *`,
          `a[href="${location.origin}/"] *`,
          `a[href^="${location.origin}/?"] *`,
          `a[href="${location.href}"] *`,
          `a[href="${location.pathname}"] *`,
          `a[href="/"]`,
          `a[href="#/"]`,
          `a[href="${location.origin}"]`,
          `a[href="${location.origin}/"]`,
          `a[href^="${location.origin}/?"]`,
          `a[href="${location.href}"]`,
          `a[href="${location.pathname}"]`,
          `a[href="/"]>*`,
          `a[href="/home"]>*`,
          `a[href="#/"]>*`,
          `a[href="${location.origin}"]+*`,
          `a[href="${location.origin}/"]+*`,
          `a[href^="${location.origin}/?"]+*`,
          `a[href="${location.href}"]+*`,
          `a[href="${location.pathname}"]+*`,
        ]),
      ]
        .map((el) => window.getComputedStyle(el).getPropertyValue(`background-image`))
        .filter((el) => el !== 'none')
        .map((el) => ({
          priority: 2,
          type: 'css:background-image/home-leading',
          boundingRect: getBoundingClientRect(el),
          url: el, // extractURL
        })),
    () =>
      [
        ...document.querySelectorAll([
          `#logo img`,
          `[aria-label*="home"] img`,
          `a[href="/"] img`,
          `a[href="#/"] img`,
          `a[href^="/?"] img`,
          `[rel="home"] img`,
          `a[href="/home"] img`,
          `a[href="${location.origin}"] img`,
          `a[href="${location.origin}/"] img`,
          `a[href^="${location.origin}/?"] img`,
          `a[href="${location.href}"] img`,
          `a[href="${location.pathname}"] img`,
        ]),
      ].map((el) => ({
        priority: 1,
        boundingRect: getBoundingClientRect(el),
        type: 'img-nested/home-leading',
        url: el.getAttribute('src'),
      })),
    () =>
      [
        ...document.querySelectorAll([
          `#logo svg`,
          `[aria-label*="home"] svg`,
          `a[href="/"] svg`,
          `a[href="/home"] svg`,
          `a[href="#/"] svg`,
          `a[href^="/?"] svg`,
          `[rel="home"] svg`,
          `a[href="${location.origin}"] svg`,
          `a[href="${location.origin}/"] svg`,
          `a[href^="${location.origin}/?"] svg`,
          `a[href="${location.href}"] svg`,
          `a[href="${location.pathname}"] svg`,
        ]),
      ].map((el) => {
        el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return {
          priority: 2,
          type: 'img-nested/home-leading-svg',
          boundingRect: getBoundingClientRect(el),
          data: true,
          url: checkSVGuse(el), // svgToDataURL
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
  'css:background-image/home-leading': extractURL,
};

const adjustWeights = (logoPalettes) => {
  logoPalettes.forEach((logo) => {
    if (logo.type !== 'img-nested/home-leading-svg' && logo.fileName.endsWith('.svg')) {
      logo.priority -= 1;
    }
    if (LOGO_TYPES.includes(logo.type) && !logo.palette) {
      logo.priority += 1;
    }

    if (LOGO_TYPES.includes(logo.type) && logo.palette && (!logo.palette.colors || logo.palette.colors.length === 0)) {
      logo.priority += 1;
    }

    if (logo.palette && logo.palette.colors.length === 1 && ['#000000', '#FFFFFF'].includes(logo.palette.colors[0])) {
      logo.priority += 1;
    }
    if (logo.palette && logo.palette.mainColor && ['#000000', '#ffffff'].includes(logo.palette.mainColor)) {
      logo.priority += 1;
    }

    if (logo.boundingRect && logo.boundingRect.isVisible) {
      logo.priority -= 1;
    }

    if (ICON_TYPES.includes(logo.type) && logo.size && !logo.fileName.includes('apple-touch-icon')) {
      const size = Number.parseInt(logo.size.split('x'), 10) || 0;
      logo.priority -= Math.round(size / 16);
    }
  });

  return orderBy(logoPalettes, ['priority'], ['asc']);
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
    .filter((logo) => logo.url && !logo.url.toLowerCase().includes('sprite'))
    .map((logo) => {
      if (logo.url && logo.url.startsWith('//')) {
        logo.url = `${parsedUrl.protocol}${logo.url}`;
      }

      return logo;
    });

  const correctLogos = uniqBy(
    orderBy(
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
    ),
    'url'
  );

  debug(JSON.stringify(correctLogos, null, 2));
  return correctLogos;
};

module.exports = {
  scrapePage,
  processScrapedLogos,
  getBestLogo,
  getBestIcon,
  adjustWeights,
};
