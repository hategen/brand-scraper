const path = require('path');
const fs = require('fs');
const original = require('./scrapingTestConfig.json');

const z = fs
  .readdirSync(path.join(__dirname, 'errors_1_wawe'))
  .filter((file) => {
    return file.startsWith('error_');
  })
  .map((e) => {
    return e.replace('error', '_').replace('www', '_').replace('https', '_').replace('http', '_').replace('.html', '_');
  });

const x = z.map((el) => el.match(/_+(.+)_/)[1].replace('_', '.'));

const t = x.map((el) => {
  return original.find((orel) => orel.includes(el));
}).filter(el=>!!el);
t;

const cleanList = original.filter(el=>!t.includes(el));

cleanList
