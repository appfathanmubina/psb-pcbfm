'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sources = [
  ['PWA', fs.readFileSync('frontend/app.js', 'utf8')],
  ['Apps Script', fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8')]
];

for (const [label, source] of sources) {
  assert.match(source, /id="rememberMe" type="checkbox"/,
    label + ' login must expose an explicit Remember Me checkbox');
  assert.match(source, /name="username" autocomplete="username"/,
    label + ' username must be recognized by browser password managers');
  assert.match(source, /name="password" type="password" autocomplete="current-password"/,
    label + ' password must be recognized as a current password');
  assert.match(source, /localStorage\.getItem\('psb_remember_me'\)==='true'/,
    label + ' Remember Me choice must persist across login renders');
  assert.match(source, /function restoreRememberedLogin\(/,
    label + ' must restore a saved username and supported browser credential');
  assert.match(source, /navigator\.credentials\.get\(\{password:true,mediation:'optional'\}\)/,
    label + ' must request browser-managed credentials without automatically logging in');
  assert.match(source, /function rememberLoginCredentials\(identifier,password\)/,
    label + ' must save credentials only after successful authentication');
  assert.match(source, /new window\.PasswordCredential\(\{id:String\(identifier\|\|''\),password:String\(password\|\|''\)\}\)/,
    label + ' must use the browser credential store when supported');
  assert.match(source, /navigator\.credentials\.store\(credential\)/,
    label + ' must delegate password storage to the browser credential manager');
  const save = source.slice(source.indexOf('function rememberLoginCredentials('), source.indexOf('\n}', source.indexOf('function rememberLoginCredentials(')) + 2);
  assert.doesNotMatch(save, /localStorage\.setItem\([^\n]*password/i,
    label + ' must never store a password in localStorage');
  assert.match(source, /rememberLoginCredentials\(identifier,password\)/,
    label + ' must persist credentials after successful login');
  assert.match(source, /localStorage\.removeItem\('psb_remembered_identifier'\)/,
    label + ' must clear the remembered identifier when Remember Me is unchecked');
}

const pwa = sources[0][1];
const appsScript = sources[1][1];
assert.match(pwa, /restoreRememberedLogin\(\);/,
  'PWA login screen must invoke credential restoration');
assert.match(appsScript, /restoreRememberedLogin\(\);/,
  'Apps Script login screen must invoke credential restoration');
for (const [label, source] of sources) {
  assert.match(source, /onchange="if\(!this\.checked\)/,
    label + ' unchecking Remember Me must immediately clear the remembered identity');
}
console.log('Remember Me and secure login autofill safeguards passed.');
