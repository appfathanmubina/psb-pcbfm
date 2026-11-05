'use strict';

const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '..', 'apps-script', 'Index.html');
const bundlePath = path.join(__dirname, '..', 'frontend', 'psb-fm-apps-script.js');
const html = fs.readFileSync(htmlPath, 'utf8');
const maxHtmlBytes = 150 * 1024;
const htmlBytes = Buffer.byteLength(html, 'utf8');
const bundleUrl = 'https://appfathanmubina.github.io/psb-pcbfm/psb-fm-apps-script.js?v=20261105-3';

if (!fs.existsSync(bundlePath)) {
  throw new Error('Apps Script client bundle is missing from the GitHub Pages source.');
}
if (!html.includes(bundleUrl)) {
  throw new Error('Index.html must load the versioned Apps Script client bundle from GitHub Pages.');
}
if (htmlBytes >= maxHtmlBytes) {
  throw new Error('Apps Script HTML payload is ' + htmlBytes + ' bytes; expected less than ' + maxHtmlBytes + ' bytes.');
}

console.log('Apps Script HTML payload guard passed: ' + htmlBytes + ' bytes; client JS is externalized.');
