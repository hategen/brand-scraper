module.exports = {
  OVERRIDE_USER_AGENT: false,
  MAKE_FULL_SCREENSHOT: false,
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
  PALETTE_ELEMENT_WIDTH: 100,
  PALETTE_MAX_COLORS: 5,
  PALETTE_PIXEL_SKIP: 5,
  PALETTES_FOLDER: 'palettes',
  TMP_FOLDER: 'tmp',
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
    logo: [],
  },
  DEFAULT_VIEWPORT: { width: 1920, height: 1080 },
  DEFAULT_PAGE_WAIT_TIMEOUT: 1000,
};
