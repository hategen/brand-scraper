const express = require('express');
const cors = require('cors');
const path = require('path');
const { scrape } = require('./scrape');

const app = express();
const port = 3007;
app.use('/static', express.static(path.join(__dirname, 'palettes')));
app.use('/static', express.static(path.join(__dirname, 'tmp')));
app.use(cors());

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// eslint-disable-next-line consistent-return
app.get('/scrape', (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    return next(new Error('No url specified'));
  }

  try {
    new URL(url);
  } catch (e) {}

  scrape(url)
    .then((data = {}) => {
      res.json(data);
    })
    .catch((err) => {
      return next(err);
    });
});

app.listen(port, () => {
  console.log(`scraper http://localhost:${port}`);
});
