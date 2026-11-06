'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('frontend/index.html', 'utf8');
const bridge = fs.readFileSync('frontend/api-bridge.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('frontend/manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('frontend/sw.js', 'utf8');

const productionUrl = "https://script.google.com/macros/s/AKfycbxs1zVZdEFwbhHFVO5nGHHhEqHQDdjVOVjfnWc1Kc6mhD5t_n8VgrdUTKhAvg8JGiau/exec";
assert.ok(bridge.includes(productionUrl), 'Main PWA must use the existing production Apps Script Web App');
assert.doesNotMatch(bridge, /AKfycbybY_5ALnk_UeKIE05BlXFM2AzvcXv9zUQrFD163k8NwCB8mDEbMhXfFSDKSeE9De6t/, 'Testing Web App endpoint must not be present in production bridge');
assert.doesNotMatch(html, /LINGKUNGAN PENGUJIAN|TESTING|testing-storage\.js/i, 'Production home page must not contain testing-only labels or storage adapter');
assert.equal(manifest.name, 'PSB Fathan Mubina', 'Installed PWA name must remain the production identity');
assert.equal(manifest.id, './', 'Production PWA identity must remain stable');
assert.equal(manifest.scope, './', 'Production PWA scope must remain at repository root');
assert.match(sw, /psb-pwa-shell-v32-33-0/, 'Production service worker must use the refreshed production cache namespace');
assert.doesNotMatch(sw, /psb-pwa-testing-/, 'Production service worker must not use testing cache namespace');
console.log('Production PWA endpoint and identity safeguards: OK');
