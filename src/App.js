import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { TextField, Container, Button } from '@material-ui/core';
import { v4 as uuidv4 } from 'uuid';
import { PaletteCard } from './PaletteCard';

import { scrape } from './api.js';
import { isValidUrl } from './utils/url.js';

const useStyles = makeStyles(() => ({
  container: {
    padding: '36px 24px',
  },
  textField: {
    width: 'calc(80% - 100px)',
    margin: '0px 24px ',
  },
  button: {
    width: '100px',
  },
}));

const scrapeUrl = (url) => scrape(url);

function Scraper() {
  const classes = useStyles();

  const [url, setUrl] = React.useState('');
  const [palettes, setPalettes] = React.useState(undefined);

  function handleChange(event) {
    const { value } = event.target;
    setUrl(value);
  }

  const getPalletes = async (pageURL) => {
    const response = await scrapeUrl(pageURL);
    setPalettes(response.data);
  };

  return (
    <div className="App">
      <Container className={classes.container}>
        <TextField className={classes.textField} value={url} onChange={handleChange} label="URL" variant="standard" />
        <Button
          className={classes.button}
          variant="contained"
          color="primary"
          onClick={() => getPalletes(url)}
          disabled={!isValidUrl(url)}
        >
          Do it
        </Button>
      </Container>
      {palettes && (
        <Container>
          {palettes.map((paletteData) => {
            const { palette, fileName, tag, safeFileName } = paletteData;
            return (
              <PaletteCard palette={palette} fileName={fileName} safeFileName={safeFileName} tag={tag} key={uuidv4()} />
            );
          })}
        </Container>
      )}
    </div>
  );
}

export default Scraper;
