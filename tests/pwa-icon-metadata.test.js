'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('frontend/manifest.webmanifest', 'utf8'));
const png = fs.readFileSync('frontend/assets/logo-fathan-mubina.png');
assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'official logo must be a valid PNG');
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
assert.equal(width, 256, 'official source logo width must be 256px');
assert.equal(height, 256, 'official source logo height must be 256px');

const icons = manifest.icons || [];
const pngIcon = icons.find(icon => icon.type === 'image/png' && icon.src.startsWith('./assets/logo-fathan-mubina.png'));
assert.ok(pngIcon, 'manifest must include the official PNG logo');
assert.equal(pngIcon.sizes, width + 'x' + height, 'PNG manifest dimensions must match the real file');

const anySvg = icons.find(icon => icon.type === 'image/svg+xml' && icon.purpose === 'any');
const maskableSvg = icons.find(icon => icon.type === 'image/svg+xml' && icon.purpose === 'maskable');
assert.ok(anySvg && anySvg.sizes === 'any', 'manifest must include a scalable SVG app icon');
assert.ok(maskableSvg && maskableSvg.sizes === 'any', 'manifest must include a scalable maskable icon');

for (const icon of icons) {
  const file = icon.src.split('?')[0].replace(/^\.\//, 'frontend/');
  assert.ok(fs.existsSync(file), 'manifest icon file must exist: ' + file);
  if (icon.type === 'image/svg+xml') {
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /<svg[^>]+viewBox="0 0 512 512"/, 'SVG icon must use a 512x512 viewBox');
    assert.match(svg, /data:image\/png;base64,/, 'SVG icon must embed the official PNG artwork');
  }
}
const maskSvgText = fs.readFileSync('frontend/icons/icon-maskable-512.svg', 'utf8');
assert.match(maskSvgText, /<rect[^>]+fill="#800080"/, 'maskable icon must provide a full-bleed background');
assert.match(fs.readFileSync('frontend/index.html', 'utf8'), /apple-touch-icon" sizes="256x256"/, 'Apple touch icon dimensions must match the actual source PNG');
console.log('PWA icon metadata and image dimensions: OK');
