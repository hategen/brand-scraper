import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { TextField, Container, Button } from '@material-ui/core';
import { v4 as uuidv4 } from 'uuid';
import { PaletteCard } from './PaletteCard/index';

import { scrape } from './api.js';
import { isValidUrl } from './utils/url.js';

const useStyles = makeStyles(() => ({
  container: {
    padding: '36px 24px',
  },
  textField: {
    width: 'calc(90% - 100px)',
    margin: '0px 24px ',
  },
  button: {
    width: '100px',
  },
  palettesContainer: {
    display: 'flex',
    flexWrap: `wrap`,
  },
  suggestionsContainer: {
    display: 'flex',
    flexWrap: `wrap`,
    background: '#dadada',
  },
}));

const scrapeUrl = (url) => scrape(url);

function Scraper() {
  const classes = useStyles();

  const [url, setUrl] = React.useState('');
  const [palettes, setPalettes] = React.useState(undefined);
  const [suggestions, setSuggestions] = React.useState(undefined);
  const [suggestedPalette, setSuggestedPalette] = React.useState(undefined);

  function handleChange(event) {
    const { value } = event.target;
    setUrl(value);
  }

  const getPalletes = async (pageURL) => {
    const response = await scrapeUrl(pageURL);
    setPalettes(response.data.rawPalettes);
    setSuggestions(response.data.suggestions);
    setSuggestedPalette(response.data.suggestedPalette);
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
      {suggestions && suggestions.length > 0 && (
        <Container className={classes.suggestionsContainer}>
          {suggestions.map((paletteData) => {
            const { palette, fileName, tag, safeFileName, type, priority, weight } = paletteData;
            return (
              <PaletteCard
                palette={palette}
                fileName={fileName}
                safeFileName={safeFileName}
                type={type}
                priority={priority}
                tag={tag}
                key={uuidv4()}
                weight={weight}
              />
            );
          })}
          {suggestedPalette && suggestedPalette[0] && suggestedPalette[1] && suggestedPalette[2] && (
            <PaletteCard
              palette={{ colors: suggestedPalette }}
              fileName="suggested palette"
              safeFileName="suggested palette"
              type="suggested palette"
            />
          )}
        </Container>
      )}
      {palettes && palettes.length > 0 && (
        <Container className={classes.palettesContainer}>
          {palettes.map((paletteData) => {
            const { palette, fileName, tag, safeFileName, type, priority, weight } = paletteData;
            return (
              <PaletteCard
                palette={palette}
                fileName={fileName}
                safeFileName={safeFileName}
                type={type}
                priority={priority}
                tag={tag}
                key={uuidv4()}
                weight={weight}
              />
            );
          })}
        </Container>
      )}
    </div>
  );
}

export default Scraper;
