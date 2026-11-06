'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('frontend/index.html', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const bridge = fs.readFileSync('frontend/api-bridge.js', 'utf8');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('frontend/manifest.webmanifest', 'utf8'));

assert.match(html, /LINGKUNGAN PENGUJIAN[^<]*BUKAN PRODUKSI/, 'Testing page must show a visible non-production warning');
assert.match(html, /<title>PSB Fathan Mubina — TESTING<\/title>/, 'Testing page title must be distinct');
assert.match(bridge, /const BRIDGE_URL = "https:\/\/script\.google\.com\/macros\/s\/AKfycbybY_5ALnk_UeKIE05BlXFM2AzvcXv9zUQrFD163k8NwCB8mDEbMhXfFSDKSeE9De6t\/exec";/, 'Testing PWA must target the supplied testing Web App');
assert.match(app, /localStorage\.getItem\('psb_session_testing'\)/, 'Testing session storage must be isolated from production');
assert.match(app, /localStorage\.getItem\('psb_public_config_testing'\)/, 'Testing public config storage must be isolated from production');
assert.match(app, /const PSB_PUBLIC_GALLERY_BASE_URL = '\.\/gallery\/'/, 'Testing gallery must remain under the testing subpath');
assert.doesNotMatch(app, /https:\/\/appfathanmubina\.github\.io\/psb-pcbfm\/gallery\//, 'Testing gallery must not point to production root');
assert.match(sw, /psb-pwa-testing-shell-v1/, 'Testing service worker must use a unique cache namespace');
assert.match(sw, /keys\.filter\(key=>key\.startsWith\('psb-pwa-testing-'\)&&key!==CACHE\)/, 'Testing service worker may only clean its own old caches');
assert.equal(manifest.id, './', 'Testing manifest identity must be relative to its dedicated subpath');
assert.equal(manifest.scope, './', 'Testing manifest scope must remain inside the testing subpath');
assert.equal(manifest.start_url, './', 'Testing app must start inside the testing subpath');
assert.match(manifest.name, /TESTING/, 'Installed app must be distinguishable from production');
console.log('Testing PWA isolation safeguards: OK');
