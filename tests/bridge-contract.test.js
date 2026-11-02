'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const bridgeServer = fs.readFileSync('apps-script/BridgeServer.gs', 'utf8');
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
assert.match(code, /psbIssuePwaBridgeToken_\(origin\)/, 'Bridge GET must issue an origin-bound transport token');
assert.match(bridgeServer, /function\s+doPost\s*\(/, 'Apps Script must expose the form POST transport endpoint');
assert.match(bridgeServer, /psbConsumePwaBridgeToken_\(payload\.token,\s*origin\)/, 'POST must consume an origin-bound transport token');
assert.match(bridgeServer, /PSB_PWA_BRIDGE_TOKEN_MAX_USES_\s*=\s*20/, 'Bridge token must have a small fixed request budget');
assert.match(bridgeServer, /PSB_PWA_BRIDGE_TOKEN_TTL_SECONDS_\s*=\s*180/, 'Bridge token must expire quickly');
assert.match(bridgeServer, /record\.remaining\s*=\s*Math\.floor\(Number\(record\.remaining\)\)\s*-\s*1/, 'Token budget must be decremented atomically');
assert.match(bridgeServer, /record\.expiresAt\s*\|\|\s*0\)\s*<=\s*Date\.now\(\)/, 'Token expiry must not be extended on use');
assert.match(bridgeServer, /LockService\.getScriptLock\(\)/, 'Token budget decrement must be serialized');
assert.match(bridgeServer, /cache\.remove\(key\)/, 'Exhausted or invalid tokens must be removed');
assert.match(bridgeServer, /PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS\.indexOf\(functionName\)/, 'POST must enforce the backend function allowlist');
assert.match(bridgeServer, /pwaBridgeCall\(functionName,\s*payload\.args\)/, 'POST must dispatch only through the existing backend dispatcher');
assert.match(bridgeServer, /window\.top\.postMessage\(message/, 'POST response must be relayed to the top-level PWA window');
assert.match(bridgeHtml, /window\.top\.postMessage\(/, 'Bridge GET must send its token outbound to the PWA');
assert.match(bridgeHtml, /bridgeChallenge/, 'Bridge GET must echo the per-session challenge');
assert.doesNotMatch(bridgeHtml, /google\.script\.run/, 'Bridge handshake must not depend on inbound google.script.run transport');

assert.ok(apiBridge.includes('const BRIDGE_URL = "https://script.google.com/macros/s/') && apiBridge.includes('/exec";'),
  'PWA must target the configured Apps Script Web App /exec URL');
assert.match(apiBridge, /iframe\.src\s*=\s*BRIDGE_URL\s*\+\s*'\?bridge=1/, 'PWA must request a tokenized bridge GET');
assert.match(apiBridge, /form\.method\s*=\s*'POST'/, 'PWA RPC must use native form POST');
assert.match(apiBridge, /form\.target\s*=\s*frameName/, 'Each RPC response must have an isolated iframe target');
assert.match(apiBridge, /form\.submit\(\)/, 'PWA must submit the RPC payload without iframe postMessage');
assert.doesNotMatch(apiBridge, /contentWindow\.postMessage/, 'PWA must not send postMessage into the Apps Script iframe');
assert.match(apiBridge, /host\.endsWith\('-script\.googleusercontent\.com'\)/,
  'PWA must trust the actual Apps Script HTML Service host suffix');
assert.match(apiBridge, /isTrustedBridgeOrigin\(event\.origin\)/, 'PWA must validate the response origin');
assert.match(apiBridge, /pending\.get\(challenge\)/, 'PWA must correlate every response with its unpredictable challenge');
assert.match(apiBridge, /let tokenSession = null/, 'PWA must retain the short-lived token session in memory');
assert.match(apiBridge, /let tokenPromise = null/, 'Concurrent RPCs must share a single token handshake');
assert.match(apiBridge, /TOKEN_MAX_USES = 20/, 'Client request budget must match backend token budget');
assert.match(apiBridge, /tokenSession\.remaining -= 1/, 'Client must reserve each bounded token use');
assert.match(apiBridge, /MAX_PAYLOAD_CHARS/, 'PWA must bound the serialized request payload');
assert.match(bridgeServer, /PWA_ALLOWED_ORIGINS/, 'Backend must support configured PWA origins');
assert.match(bridgeServer, /PSB_PWA_BRIDGE_TOKEN_/, 'Bridge tokens must use a dedicated cache namespace');

console.log('PWA ↔ Apps Script reusable form-POST bridge contract: OK (' + clientCalls.size +
  ' client RPC names checked against ' + allowed.size + ' allowlisted backend functions)');
