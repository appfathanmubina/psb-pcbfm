'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('frontend/index.html', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const storage = fs.readFileSync('frontend/testing-storage.js', 'utf8');
const bridge = fs.readFileSync('frontend/api-bridge.js', 'utf8');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('frontend/manifest.webmanifest', 'utf8'));

assert.match(html, /testing-storage\.js\?v=1\.0\.0/, 'Testing storage adapter must load before the app bundle');
assert.match(html, /LINGKUNGAN PENGUJIAN[^<]*BUKAN PRODUKSI/, 'Testing page must show a visible non-production warning');
assert.match(html, /<title>PSB Fathan Mubina — TESTING<\/title>/, 'Testing page title must be distinct');
assert.match(bridge, /const BRIDGE_URL = "https:\/\/script\.google\.com\/macros\/s\/AKfycbybY_5ALnk_UeKIE05BlXFM2AzvcXv9zUQrFD163k8NwCB8mDEbMhXfFSDKSeE9De6t\/exec";/, 'Testing PWA must target the supplied testing Web App');
assert.match(storage, /psb_session_testing/, 'Testing session storage must be isolated from production');
assert.match(storage, /psb_public_config_testing/, 'Testing public config storage must be isolated from production');
assert.match(app, /const PSB_PUBLIC_GALLERY_BASE_URL = 'https:\/\/appfathanmubina\.github\.io\/psb-pcbfm\/gallery\/'/, 'Testing PWA may reuse the shared public image gallery');
assert.match(sw, /psb-pwa-testing-shell-v1/, 'Testing service worker must use a unique cache namespace');
assert.match(sw, /testing-storage\.js\?v=1\.0\.0/, 'Testing service worker must precache its storage isolation adapter');
assert.match(sw, /keys\.filter\(key=>key\.startsWith\('psb-pwa-testing-'\)&&key!==CACHE\)/, 'Testing service worker may only clean its own old caches');
assert.equal(manifest.id, './', 'Testing manifest identity must be relative to its dedicated subpath');
assert.equal(manifest.scope, './', 'Testing manifest scope must remain inside the testing subpath');
assert.equal(manifest.start_url, './', 'Testing app must start inside the testing subpath');
assert.match(manifest.name, /TESTING/, 'Installed app must be distinguishable from production');
console.log('Testing PWA isolation safeguards: OK');
