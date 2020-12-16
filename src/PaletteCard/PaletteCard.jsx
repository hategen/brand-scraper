import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Box from '@material-ui/core/Box';
import CardMedia from '@material-ui/core/CardMedia';
import CardHeader from '@material-ui/core/CardHeader';
import { v4 as uuidv4 } from 'uuid';

import { invertColor } from '../utils/color';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    display: 'flex',
  },
  image: {
    width: 'auto',
    maxHeight: '100px',
    objectFit: 'contain',
  },
  box: {
    display: 'flex',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
}));

export function PaletteCard({ palette, fileName, tag }) {
  const classes = useStyles();

  if (!palette) {
    return null;
  }
  const { mainColor = '#000000', colors = [] } = palette;
  const fullColorList = [mainColor, ...colors];
  return (
    <Card className={classes.root}>
      <div className={classes.details}>
        <CardHeader title={fileName || tag} />
        <Box className={classes.content}>
          {fileName ? (
            <CardMedia
              className={classes.image}
              component="img"
              image={`http://localhost:3007/static/${fileName}`}
              title={fileName}
            />
          ) : null}
          <CardContent className={classes.content}>
            {fullColorList.map((color) => {
              const style = {
                background: color,
                color: invertColor(color),
              };
              return (
                <Box key={uuidv4()} style={style} className={classes.box}>
                  {color}
                </Box>
              );
            })}
          </CardContent>
        </Box>
      </div>
    </Card>
  );
}
