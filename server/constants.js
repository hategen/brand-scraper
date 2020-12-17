module.exports = {
  PALETTE_ELEMENT_WIDTH: 100,
  PALETTE_MAX_COLORS: 4,
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
        `[type="submit]"`,
      ],
      properties: ['color', 'background-color'],
    },
    logo: [],
  },
  DEFAULT_VIEWPORT: { width: 1920, height: 1080 },
  DEFAULT_PAGE_WAIT_TIMEOUT: 1000,
};
