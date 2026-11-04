'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pwa = fs.readFileSync('frontend/app.js', 'utf8');
const apps = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const bridge = fs.readFileSync('apps-script/BridgeServer.gs', 'utf8');
const galleryDir = 'frontend/gallery';

function manifest(source, label) {
  const match = source.match(/const PSB_PUBLIC_GALLERY_FILES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(match, label + ' must declare the GitHub gallery manifest');
  return Array.from(match[1].matchAll(/["']([^"']+\.jpe?g)["']/gi), item => item[1]);
}

const pwaFiles = manifest(pwa, 'PWA');
const appsFiles = manifest(apps, 'Apps Script UI');
assert.deepEqual(appsFiles, pwaFiles, 'Both UI surfaces must use the same gallery file order');
assert.equal(pwaFiles.length, 21, 'Expected 21 approved gallery images');
for (const file of pwaFiles) {
  assert.ok(fs.existsSync(path.join(galleryDir, file)), 'Gallery image must exist: ' + file);
}
assert.match(pwa, /https:\/\/appfathanmubina\.github\.io\/psb-pcbfm\/gallery\//);
assert.match(apps, /https:\/\/appfathanmubina\.github\.io\/psb-pcbfm\/gallery\//);
assert.match(pwa, /encodeURIComponent\(file\)/);
assert.match(apps, /encodeURIComponent\(file\)/);
assert.doesNotMatch(pwa, /server\(['"]getPublicGallery['"]/);
assert.doesNotMatch(apps, /server\(['"]getPublicGallery['"]/);
assert.doesNotMatch(backend, /function\s+getPublicGallery\s*\(/);
assert.doesNotMatch(backend, /PSB_PUBLIC_GALLERY_(?:FILE_IDS|FOLDER_ID)|drive\.google\.com\/thumbnail/i);
assert.doesNotMatch(backend, /['"]getPublicGallery['"]/);
assert.doesNotMatch(bridge, /getPublicGallery/);
console.log('GitHub-only gallery source and asset safeguards: OK (21 images)');
