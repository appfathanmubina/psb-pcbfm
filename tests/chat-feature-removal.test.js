'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');
const appsUi = fs.readFileSync('apps-script/Index.html', 'utf8');
const pwaUi = fs.readFileSync('frontend/app.js', 'utf8');
const styles = fs.readFileSync('frontend/styles.css', 'utf8');

for (const [name, source] of Object.entries({ code, appsUi, pwaUi, styles })) {
  assert.doesNotMatch(source, /OneSignal|onesignal/i, name + ' must not contain OneSignal integration');
}
for (const endpoint of [
  'getChatPageData', 'getChatThread', 'openChatThread', 'sendChatMessage',
  'markChatThreadRead', 'closeChatThread', 'cleanupChatRetention', 'runChatAutomationNow'
]) {
  assert.doesNotMatch(code, new RegExp('function\\s+' + endpoint + '\\s*\\('), 'removed backend endpoint: ' + endpoint);
  assert.ok(!code.includes("'" + endpoint + "'"), 'removed bridge allowlist endpoint: ' + endpoint);
  assert.ok(!appsUi.includes(endpoint) && !pwaUi.includes(endpoint), 'removed UI call: ' + endpoint);
}
assert.doesNotMatch(code, /PSB_CHAT_ACCESS_ROLES|PSB_CHAT_ADMIN_ROLES|CHAT_THREADS|CHAT_MESSAGES|canChat/);
assert.doesNotMatch(appsUi + pwaUi + styles, /chat-fab|chat-layout|chatPollTimer|chatThread|goPage\(['"]chat['"]\)/i);
assert.doesNotMatch(appsUi + pwaUi, /\['chat','Chat','chat'\]|\['chat','Chat'/i, 'removed Chat navigation entry');
assert.doesNotMatch(setup, /CHAT_THREADS|CHAT_MESSAGES|CHAT_RETENTION_DAYS|CHAT_AUTOMATION_ENABLED|ensureChatAutomationTrigger_|installChatAutomationTrigger_/);
assert.match(setup, /function removeLegacyChatAutomationTriggers_\(\)/);
assert.match(setup, /function cleanupLegacyChatAutomationTriggers\(\)/);
assert.match(setup, /function cleanupLegacyChatAutomationTriggers\(\)\s*\{[\s\S]*?SpreadsheetApp\.getUi\(\)/,
  'Manual trigger cleanup must require the bound spreadsheet editor UI');
assert.match(setup, /ui\.alert\([\s\S]*?ui\.ButtonSet\.YES_NO/,
  'Manual trigger cleanup must require explicit editor confirmation');
assert.match(setup, /legacyHandlers = \['runChatAutomation', 'runChatAutomation_'\]/);
assert.match(setup, /ScriptApp\.deleteTrigger\(trigger\)/);
assert.doesNotMatch(setup, /ScriptApp\.newTrigger\(/);
assert.doesNotMatch(setup, /deleteSheet\(/);
assert.match(code, /function getNotifications\(/);
assert.match(code, /function markNotificationRead\(/);
assert.match(code, /function getCommunicationCenterData\(/);
assert.match(code, /function sendCommunication\(/);
assert.match(appsUi, /function renderNotifications\(/);
assert.match(pwaUi, /function renderNotifications\(/);
console.log('PSB Chat retirement and legacy trigger cleanup safeguards: OK');
