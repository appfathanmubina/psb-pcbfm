'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const apiBridge = fs.readFileSync('frontend/api-bridge.js', 'utf8');
const bridgeHtml = fs.readFileSync('apps-script/Bridge.html', 'utf8');

const allowlistMatch = code.match(/const PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(allowlistMatch, 'Backend PWA bridge allowlist must exist');
const allowed = new Set(Array.from(allowlistMatch[1].matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g), m => m[1]));
assert.ok(allowed.size > 0, 'Backend PWA bridge allowlist must not be empty');

const clientCalls = new Set(Array.from(app.matchAll(/\bserver\(\s*['"]([A-Za-z_$][\w$]*)['"]/g), m => m[1]));
const missing = [...clientCalls].filter(name => !allowed.has(name)).sort();
assert.deepEqual(missing, [], 'PWA server() calls missing from backend bridge allowlist');

const backendFunctions = new Set(Array.from(code.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm), m => m[1]));
const unresolved = [...allowed].filter(name => !backendFunctions.has(name)).sort();
assert.deepEqual(unresolved, [], 'Bridge allowlist names without backend function declarations');

assert.match(code, /function\s+pwaBridgeCall\s*\(/, 'Backend bridge dispatcher must exist');
assert.match(code, /function\s+getPwaBridgeConfig\s*\(/, 'Backend bridge configuration endpoint must exist');
assert.match(bridgeHtml, /\.pwaBridgeCall\(fn,args\)/, 'HTML bridge must dispatch through the allowlisted backend');
assert.match(bridgeHtml, /\.getPwaBridgeConfig\(\)/, 'HTML bridge must load configured trusted origins');
assert.match(bridgeHtml, /\\bPWA_SOURCE\\s*=\\s*['"]psb-fm-pwa['"]/, 'HTML bridge must verify the PWA message source');
assert.match(apiBridge, /const\s+PWA_SOURCE\s*=\s*['"]psb-fm-pwa['"]/, 'PWA transport source identifier must match');
assert.match(apiBridge, /event\.source!==iframe\?\.contentWindow/, 'PWA must verify the message source window');
assert.match(apiBridge, /isTrustedBridgeOrigin\(event\.origin\)/, 'PWA must validate bridge message origin');
assert.match(bridgeHtml, /const\s+DEFAULT_ALLOWED_ORIGINS\s*=\s*\[['"]https:\/\/appfathanmubina\.github\.io['"]\]/,
  'HTML bridge default origin must match the deployed GitHub Pages origin');
assert.match(code, /PWA_ALLOWED_ORIGINS/, 'Backend must support configured PWA origins');

console.log('PWA ↔ Apps Script bridge contract: OK (' + clientCalls.size +
  ' client RPC names checked against ' + allowed.size + ' allowlisted backend functions)');
