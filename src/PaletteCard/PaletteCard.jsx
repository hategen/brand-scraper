import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Box from '@material-ui/core/Box';
import CardMedia from '@material-ui/core/CardMedia';
import Typography from '@material-ui/core/Typography';
import { v4 as uuidv4 } from 'uuid';

import { invertColor } from '../utils/color';

const useStyles = makeStyles(() => ({
  root: {
    overflow: 'visible',
    margin: '10px',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    display: 'flex',
  },
  title: {
    fontSize: 14,
    padding: '10px 10px',
  },
  image: {
    width: 'auto',
    maxHeight: '80px',
    objectFit: 'contain',
    margin: '10px',
  },
  box: {
    display: 'flex',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
}));

export function PaletteCard({ palette, safeFileName, fileName, tag, type, priority, weight }) {
  const classes = useStyles();

  if (!palette) {
    return null;
  }
  const { mainColor = '#000000', colors = [] } = palette;
  const fullColorList = [mainColor, ...colors];
  return (
    <Card className={classes.root} variant="outlined">
      <div className={classes.details}>
        <Box className={classes.content}>
          {priority ? (
            <Typography className={classes.title} color="textPrimary" gutterBottom>
              {priority}
            </Typography>
          ) : null}

          {type ? (
            <Typography className={classes.title} color="textSecondary" gutterBottom>
              {type}
            </Typography>
          ) : null}
          {weight ? (
            <Typography className={classes.title} color="textSecondary" gutterBottom>
              {weight}
            </Typography>
          ) : null}
          <Typography className={classes.title} color="textSecondary" gutterBottom>
            {safeFileName || palette.tag}
          </Typography>
        </Box>

        <Typography className={classes.title} color="textSecondary" gutterBottom>
          {fileName || tag}
        </Typography>
        <Box className={classes.content}>
          {safeFileName || fileName ? (
            <CardMedia
              className={classes.image}
              component="img"
              image={`http://localhost:3007/static/${safeFileName || fileName}`}
              title={safeFileName}
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
