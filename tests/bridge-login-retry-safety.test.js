'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const bridge = fs.readFileSync('apps-script/BridgeServer.gs', 'utf8');
const client = fs.readFileSync('frontend/api-bridge.js', 'utf8');

const consumeStart = bridge.indexOf('function psbConsumePwaBridgeToken_(');
const consumeEnd = bridge.indexOf('\nfunction psbBridgeJsonForHtml_', consumeStart);
assert.ok(consumeStart >= 0 && consumeEnd > consumeStart, 'Bridge token consumer exists');
const consume = bridge.slice(consumeStart, consumeEnd);
assert.match(consume, /lock\.waitLock\(10000\)/,
  'Token accounting must tolerate short ScriptLock contention');
assert.match(consume, /code: 'BRIDGE_TEMPORARILY_BUSY'/,
  'Lock timeout must be distinguishable from an invalid or expired token');

const postStart = bridge.indexOf('function doPost(');
const post = bridge.slice(postStart);
const consumeCall = post.indexOf('psbConsumePwaBridgeToken_(payload.token, origin)');
const dispatchCall = post.indexOf('pwaBridgeCall(functionName, payload.args)');
assert.ok(consumeCall >= 0 && dispatchCall > consumeCall,
  'Bridge token consumption must happen before backend dispatch');
assert.match(post, /tokenResult !== true[\s\S]*?return fail\(tokenResult && tokenResult\.code/,
  'A failed token/lock check must return a structured pre-dispatch response');

const retryStart = client.indexOf('async function callWithToken(');
const retry = client.slice(retryStart);
assert.match(retry, /BRIDGE_TEMPORARILY_BUSY/,
  'Client should recognize transient bridge lock contention');
assert.match(retry, /if \(retry && safeToRetry\)/,
  'Transient retries must be limited to one attempt');
assert.match(retry, /callWithToken\(fn, args, false\)/,
  'The retry must not loop indefinitely');
const requestCall = retry.indexOf('submitBridgeRequest(token, fn, args)');
const retryCondition = retry.indexOf('if (retry && safeToRetry)');
assert.ok(requestCall >= 0 && retryCondition > requestCall,
  'Retry classification must only run after a failed transport request');
assert.match(retry, /Backend is never invoked when token consumption fails/,
  'Only failures known to occur before backend dispatch may be retried');

console.log('Bridge lock contention retry safety: OK');
