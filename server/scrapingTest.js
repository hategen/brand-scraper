const axios = require('axios');
const pageListxx = require('./scrapingTestConfig.json');
const pageList = require('./scrapingTestConfigErrors.json');
const handlebars = require('handlebars');
const path = require('path');
const fs = require('fs');
const reportTemplate = require('./scraper.hbs');
const errorTemplate = require('./scraperError.hbs');

process.on('unhandledRejection', (error) => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message);
});
process.on('uncaughtException', (err) => {
  console.log('uncaughtException', err);
});

const scrapePage = async (url) => {
  let response;
  try {
    const headers = { 'Access-Control-Allow-Origin': '*' };
    const config = {
      url: `http://localhost:3007/scrape?url=${encodeURIComponent(url)}`,
      method: 'GET',
      timeout: 60000,
      crossdomain: true,
      headers,
    };

    response = await axios(config);

    return { data: response.data };
  } catch (error) {
    if (error.response) {
      response = {
        error: error.response.data,
        status: error.response.status,
      };
    } else {
      response = error;
    }

    throw response;
  }
};

async function scrape(pageList) {
  for (let url of pageList.slice(730)) {
    const reportFileName = url.replace('://', '_').replace('.', '_').replace('/', '_').replace(`\\`, '_');
    const reportPath = path.join(__dirname, 'report', `${reportFileName}.html`);
    const errorPath = path.join(__dirname, 'report', `error_${reportFileName}.html`);
    let start;
    let totalTime;
    try {
      console.log(`Scraping ${url}`);
      start = Date.now();
      const { data } = await scrapePage(url);
      totalTime = (Date.now() - start) / 1000;
      const { suggestedPalette, suggestions, screenshotFileName } = data;
      const [mainColor, secondaryColor, backgroundColor] = suggestedPalette;
      const logo = suggestions.find((el) => el.type === 'logo') ||
        suggestions.find((el) => el.type === 'icon') || { safeFileName: 'xx.png' };
      const icon = suggestions.find((el) => el.type === 'icon') ||
        suggestions.find((el) => el.type === 'logo') || { safeFileName: 'xx.png' };

      const output = reportTemplate({
        totalTime,
        mainColor,
        secondaryColor,
        backgroundColor,
        logo: `http://localhost:3007/static/${logo.safeFileName}`,
        icon: `http://localhost:3007/static/${icon.safeFileName}`,
        screenshot: `http://localhost:3007/static/${screenshotFileName}`,
        url,
        error: '',
      });

      fs.writeFileSync(reportPath, output);
      console.log(`Report recorded at ${reportPath}`);
    } catch (e) {
      console.log('FAILED TO SCRAPE ', url, e);
      const output = errorTemplate({
        url,
        errorMessage: e.message || e.error,
        errorStack: e.stack,
      });
      fs.writeFileSync(errorPath, output);
    }
  }
}

scrape(pageList);
