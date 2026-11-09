'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('frontend/app.js', 'utf8');
const appsScriptSource = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');

function section(start, end, label) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, label + ' handler exists');
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, label + ' handler boundary exists');
  return source.slice(from, to);
}

const bulk = section(
  'async function generateSelectionParticipantsUI(){',
  'async function addSelectionParticipantUI(){',
  'Bulk participant generation'
);
assert.match(bulk, /failed\?'warning':'success'/,
  'Partial bulk failures must not be presented as full success');

const single = section(
  'async function addSelectionParticipantUI(){',
  'async function updateParticipantStatusUI(',
  'Single participant assignment'
);
assert.match(single, /Status penyimpanan belum pasti/,
  'An ambiguous transport failure must prompt the user to check before retrying');

const notification = section(
  'async function markNotificationReadUI(id){',
  'async function markAllNotificationsReadUI(',
  'Notification read action'
);
assert.match(notification, /if\(!r\?\.success\)\{showToast\(/,
  'A returned notification update failure must be visible');
assert.match(notification, /catch\(e\)\{showToast\(/,
  'A notification transport failure must be visible');

for (const [label, client] of [['PWA', source], ['Apps Script UI', appsScriptSource]]) {
  assert.match(client, /function friendlyErrorMessage\(/,
    label + ' must translate transport failures into calm, actionable user copy');
  assert.match(client, /Respons server belum diterima\. Periksa status data sebelum mengirim ulang\./,
    label + ' must prevent blind retries after an ambiguous timeout');
  assert.match(client, /class="psb-toast-host" id="psbToastHost"/,
    label + ' must stack notifications in a dedicated host');
  assert.match(client, /aria-live="\$\{safeType==='error'\?'assertive':'polite'\}"/,
    label + ' notifications must announce errors accessibly');
  assert.match(client, /setTimeout\(\(\)=>\$\(id\)\?\.remove\(\),safeType==='error'\?6500:4000\)/,
    label + ' errors must stay available longer for users to read');

  const selectionRenderer = sectionFrom(
    client,
    'async function renderSelection(force=false){',
    'function renderSelectionPanel(',
    label + ' selection renderer'
  );
  assert.match(selectionRenderer, /catch\(e\)\{\$\('selectionPanel'\)\.innerHTML=showMessage\('Gagal memuat data tes dan seleksi\.'\);return false\}/,
    label + ' selection renderer must report refresh failures to the caller');
  assert.match(selectionRenderer, /if\(!r\?\.success\)[\s\S]*?return false/,
    label + ' selection renderer must report server failures to the caller');
  const refreshHelper = sectionFrom(
    client,
    'async function refreshSelectionAfterMutation(){',
    'function renderSelectionPanel(',
    label + ' selection mutation refresh'
  );
  assert.match(refreshHelper, /if\(await renderSelection\(\)===false\)showToast\(/,
    label + ' must report a caught selection refresh failure after a committed mutation');

  const clientBulk = sectionFrom(
    client,
    'async function generateSelectionParticipantsUI(){',
    'async function addSelectionParticipantUI(){',
    label + ' bulk participant generation'
  );
  assert.match(clientBulk, /failed\?'warning':'success'/,
    label + ' must flag partial bulk failures as a warning');
  assert.match(clientBulk, /await refreshSelectionAfterMutation\(\)/,
    label + ' must disclose when a saved bulk change could not be refreshed');
  const clientSingle = sectionFrom(
    client,
    'async function addSelectionParticipantUI(){',
    'async function updateParticipantStatusUI(',
    label + ' single participant assignment'
  );
  assert.match(clientSingle, /await refreshSelectionAfterMutation\(\)/,
    label + ' must disclose when a saved single change could not be refreshed');
  const clientSchedule = sectionFrom(
    client,
    'async function toggleSelectionScheduleUI(',
    'async function generateSelectionParticipantsUI(){',
    label + ' selection schedule update'
  );
  assert.match(clientSchedule, /state\.selectionTab='schedule';await refreshSelectionAfterMutation\(\)/,
    label + ' must refresh the schedule tab after a successful schedule update');
  const clientParticipantStatus = sectionFrom(
    client,
    'async function updateParticipantStatusUI(',
    'function renderSelectionResults(',
    label + ' participant status update'
  );
  assert.match(clientParticipantStatus, /state\.selectionTab='participants';await refreshSelectionAfterMutation\(\)/,
    label + ' must refresh the participants tab after a successful status update');
  assert.match(clientParticipantStatus, /Status peserta belum pasti/,
    label + ' must protect against blind retry after a transport failure');
  const clientNotification = sectionFrom(
    client,
    'async function markNotificationReadUI(id){',
    'async function markAllNotificationsReadUI(',
    label + ' notification read action'
  );
  assert.match(clientNotification, /catch\(e\)\{showToast\(/,
    label + ' must show notification transport failures');
}

function sectionFrom(input, start, end, label) {
  const from = input.indexOf(start);
  assert.notEqual(from, -1, label + ' handler exists');
  const to = input.indexOf(end, from + start.length);
  assert.ok(to > from, label + ' handler boundary exists');
  return input.slice(from, to);
}

console.log('UI mutation and refresh failure feedback safeguards passed.');
