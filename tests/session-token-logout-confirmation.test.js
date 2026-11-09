'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
for (const [label, path] of [['PWA','frontend/app.js'],['Apps Script','frontend/psb-fm-apps-script.js']]) {
  const source = fs.readFileSync(path, 'utf8');
  const openLogin = source.slice(source.indexOf('async function openLogin('), source.indexOf('\n}', source.indexOf('async function openLogin(')) + 2);
  assert.match(openLogin, /state\.token\|\|localStorage\.getItem\('psb_session'\)/,
    label + ' session check must compare against the latest token from state or localStorage');
  assert.match(openLogin, /if\(latestToken!==token\)/,
    label + ' stale session checks must not overwrite a newer token');
  assert.match(source, /authFlowId:0/,
    label + ' must track the active authentication flow');
  assert.match(openLogin, /state\.authFlowId=Number\(state\.authFlowId\|\|0\)\+1/,
    label + ' opening login must supersede pending logout notifications');
  const submitLogin = source.slice(source.indexOf('async function submitLogin('), source.indexOf('\n}', source.indexOf('async function submitLogin(')) + 2);
  assert.match(submitLogin, /state\.authFlowId=Number\(state\.authFlowId\|\|0\)\+1/,
    label + ' a new login attempt must supersede earlier auth operations');
  assert.match(submitLogin, /state\.authFlowId!==authFlowId/,
    label + ' must ignore a login response after a newer auth operation starts');
  assert.match(submitLogin, /state\.authFlowId===authFlowId&&!state\.appInitialized/,
    label + ' stale login cleanup must not hide a newer login attempt loading state');
  const logout = source.slice(source.indexOf('async function doLogout('), source.indexOf('\n}', source.indexOf('async function doLogout(')) + 2);
  assert.match(logout, /state\.authFlowId=Number\(state\.authFlowId\|\|0\)\+1/,
    label + ' logout must establish its own operation identity');
  assert.match(logout, /state\.authFlowId!==authFlowId\|\|state\.token\|\|state\.appInitialized/,
    label + ' must suppress stale logout success and failure notifications after login resumes');
  assert.match(logout, /await server\('logout',token\)/,
    label + ' must await server-side logout confirmation');
  assert.match(logout, /result\.revoked===true/,
    label + ' may report server revocation success only after explicit confirmation');
  assert.match(logout, /pencabutan sesi server belum terkonfirmasi/,
    label + ' must distinguish local logout from unconfirmed server revocation');
  assert.doesNotMatch(logout, /showToast\('Anda sudah keluar dari aplikasi\.'\s*,\s*'success'\)/,
    label + ' must not report server revocation as successful before confirmation');
}
console.log('Session token freshness and logout confirmation safeguards passed.');
