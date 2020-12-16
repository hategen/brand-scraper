export function padZero(str, len = 2) {
  const zeros = new Array(len).join('0');
  return (zeros + str).slice(-len);
}
export function invertColor(hex, bw) {
  let hexDigits = '';
  if (hex.indexOf('#') === 0) {
    hexDigits = hex.slice(1);
  }
  // convert 3-digit hex to 6-digits.
  if (hexDigits.length === 3) {
    hexDigits = hexDigits[0] + hexDigits[0] + hexDigits[1] + hexDigits[1] + hexDigits[2] + hexDigits[2];
  }
  if (hexDigits.length !== 6) {
    throw new Error('Invalid HEX color.');
  }
  let r = parseInt(hexDigits.slice(0, 2), 16);
  let g = parseInt(hexDigits.slice(2, 4), 16);
  let b = parseInt(hexDigits.slice(4, 6), 16);
  if (bw) {
    // http://stackoverflow.com/a/3943023/112731
    return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
  }
  // invert color components
  r = (255 - r).toString(16);
  g = (255 - g).toString(16);
  b = (255 - b).toString(16);
  // pad each with zeros and return
  return `#${padZero(r)}${padZero(g)}${padZero(b)}`;
}
