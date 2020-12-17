const debug = require('debug')('logoSearch');

const findJsonLdImages = (text) => {
  const info = JSON.parse(text);
  return info ? info.logo : null;
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

const isValidUrl = (url) => {
  const isValidUrl = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;
  return isValidUrl.test(url);
};

const scrapePage = () => {
  const scrapers = [
    () =>
      [...document.querySelectorAll(`meta[property="og:logo"]`)].map((el) => {
        return {
          type: 'og:logo',
          url: el.getAttribute('content'),
        };
      }),
    () =>
      [...document.querySelectorAll(`meta[property="og:image"]`)].map((el) => {
        return {
          type: 'og:image',
          url: el.getAttribute('content'),
        };
      }),
    () =>
      [...document.querySelectorAll(`meta[itemprop="logo"]`)].map((el) => {
        return {
          type: 'meta-itemprop/logo',
          url: el.getAttribute('content'),
        };
      }),
    () =>
      [...document.querySelectorAll(`link[rel*="icon"]`)].map((el) => {
        return {
          type: 'link-rel/icon',
          url: el.getAttribute('href'),
          size: el.getAttribute('sizes'),
        };
      }),
    () =>
      [...document.querySelectorAll(`img[itemprop="logo"]`)].map((el) => {
        return {
          type: 'img-itemprop/logo',
          url: el.getAttribute('src'),
        };
      }),
    () =>
      [...document.querySelectorAll(`meta[name*="msapplication-TileImage"]`)].map((el) => {
        return {
          type: 'meta-name/msapplication-TileImage',
          url: el.getAttribute('content'),
        };
      }),
    () =>
      [...document.querySelectorAll(`meta[content*="logo"]`)].map((el) => {
        return {
          type: 'meta-content/logo',
          url: el.getAttribute('content'),
        };
      }),
    () =>
      [...document.querySelectorAll(`meta[itemprop*="image"]`)].map((el) => {
        return {
          type: 'meta-content/image',
          url: el.getAttribute('content'),
        };
      }),
    () =>
      [...document.querySelectorAll(`script[type*="application/ld+json"]`)].map((el) => {
        return {
          type: 'json-ld-logo',
          url: el.innerHTML, //findJsonLdImages
        };
      }),
    () =>
      [...document.querySelectorAll(`img[alt*="logo"]`)].map((el) => {
        return {
          type: 'img-alt/logo',
          url: el.getAttribute('src'),
        };
      }),
    () =>
      [...document.querySelectorAll(`img[class*="logo"]`)].map((el) => {
        return {
          type: 'img-alt/logo-class',
          url: el.getAttribute('src'),
        };
      }),
    () =>
      [...document.querySelectorAll(`a[class*="logo"]`)].map((el) => {
        return {
          type: 'svg:image',
          data: true,
          url: el.innerHTML, //svgToDataURL
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
};

const processScrapedLogos = (logos) => {
  return logos.map((logo) => {
    if (logoProcessors[logo.type] && typeof logoProcessors[logo.type] === 'function') {
      // eslint-disable-next-line no-param-reassign
      logo.url = logoProcessors[logo.type](logo.url);
    }
    return logo;
  });
};

class LogoSearch {
  constructor(htmlContent, url) {
    this.$ = cheerio.load(htmlContent, url);
    const parsedUrl = new URL(url);
    this.host = `${parsedUrl.protocol}//${parsedUrl.host}`;
  }

  parse() {
    const logos = [
      {
        type: 'og:logo',
        url: this.$('meta[property="og:logo"]').attr('content'),
      },
      {
        type: 'meta-itemprop/logo',
        url: this.$('meta[itemprop="logo"]').attr('content'),
      },
      ...this.$('link[rel*="icon"]')
        .map((i, el) => {
          return {
            type: 'link-rel/icon',
            url: this.$(el).attr('href'),
            size: this.$(el).attr('sizes'),
          };
        })
        .get(),
      {
        type: 'img-itemprop/logo',
        url: this.$('img[itemprop="logo"]').attr('src'),
      },
      {
        type: 'meta-name/msapplication-TileImage',
        url: this.$('meta[name*="msapplication-TileImage"]').attr('content'),
      },
      {
        type: 'meta-content/logo',
        url: this.$('meta[content*="logo"]').attr('content'),
      },
      {
        type: 'meta-content/image',
        url: this.$('meta[itemprop*="image"]').attr('content'),
      },
      ...this.$('script[type*="application/ld+json"]')
        .map((i, el) => {
          return {
            type: 'json-ld-logo',
            url: findJsonLdImages(this.$(el).html()),
          };
        })
        .get(),
      {
        type: 'img-alt/logo',
        url: this.$('img[alt*="logo"]').attr('src'),
      },
      {
        type: 'img-alt/logo-class',
        url: this.$('img[class*="logo"]').attr('src'),
      },
      {
        type: 'img-src/logo',
        url: this.$('img[src*="logo"]').attr('src'),
      },
      {
        type: 'og:image',
        url: this.$('meta[property="og:image"]').attr('content'),
      },
      {
        type: 'svg:image',
        data: true,
        url: svgToDataURL(this.$('a[class*="logo"]').html()),
      },
    ].filter((e) => e.url);

    const correctLogos = logos.map((image) => {
      return !isValidUrl(image.url) && image.url.indexOf('data:') === -1
        ? {
            ...image,
            url: `${this.host}${image.url}`,
          }
        : image;
    });
    debug(JSON.stringify(correctLogos, null, 2));

    return correctLogos;
  }
}

module.exports = {
  LogoSearch,
  scrapePage,
  processScrapedLogos,
};
