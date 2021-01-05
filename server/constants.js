module.exports = {
  OVERRIDE_USER_AGENT: false,
  MAKE_FULL_SCREENSHOT: false,
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
  PALETTE_ELEMENT_WIDTH: 100,
  PALETTE_MAX_COLORS: 3,
  PALETTE_PIXEL_SKIP: 5,
  PALETTES_FOLDER: 'palettes',
  TMP_FOLDER: 'tmp',
  BUTTON_BACKGROUND_MAX_LUMINOSITY: 0.8,
  COLOR_DISTANCE_TRESHOLD: 25,
  DELTAE94_DIFF_STATUS: {
    NA: 0,
    PERFECT: 1,
    CLOSE: 2,
    GOOD: 10,
    SIMILAR: 50,
  },
  LOGO_TYPES: [
    'css:background-image',
    'css:background-image/home-leading',
    'img-nested/home-leading',
    'img-nested/home-leading-svg',
    'img-src/logo-class',
    'img-alt/logo-class',
    'img-alt/logo',
    'meta-content/image',
    'json-ld-logo',
    'img-itemprop/logo',
    'og:logo',
  ],
  ICON_TYPES: ['link-rel/icon'],
  SELECTORS: {
    buttons: {
      selectors: [
        'button',
        '.button',
        '.button-primary',
        '.btn',
        `[class*="btn"]`,
        `[class*="button"]`,
        `[type="submit"]`,
        `[type="button"]`,
        `[class*="Button"]`,
      ],
      properties: ['color', 'background-color'],
    },
    links: {
      selectors: [`a`],
      properties: ['color', 'background-color'],
    },
  },
  DEFAULT_VIEWPORT: { width: 1920, height: 1080 },
  DEFAULT_PAGE_WAIT_TIMEOUT: 1000,
};
