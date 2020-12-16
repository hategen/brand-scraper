const cheerio = require('cheerio');

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

    return correctLogos;
  }
}

module.exports = { LogoSearch };
