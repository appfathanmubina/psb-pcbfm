'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('frontend/app.js', 'utf8');
const styles = fs.readFileSync('frontend/styles.css', 'utf8');

assert.match(source, /notification-bell-wrap[^\n]*onclick="toggleNotificationPopup\(\)"/,
  'Header bell must toggle the notification pop-up');
assert.match(source, /function closeNotificationPopup\(\)/,
  'Notification pop-up must expose a close handler');
assert.match(source, /async function toggleNotificationPopup\(\)[\s\S]*?if\(\$\('notificationPopupBackdrop'\)\)\{closeNotificationPopup\(\)/,
  'Clicking the bell while open must close the pop-up');
assert.match(source, /notificationPopupBackdrop[^\n]*onclick="if\(event\.target===this\)closeNotificationPopup\(\)"/,
  'Clicking outside the notification panel must close the pop-up');
assert.match(source, /async function refreshNotificationPopup\(force=true\)/,
  'Notification pop-up must refresh its data without navigating away');
assert.match(source, /if\(\$\('notificationPopupBackdrop'\)\)await refreshNotificationPopup\(\);else await renderNotifications\(\)/,
  'Read actions must refresh the pop-up in place');
assert.match(styles, /\.notification-popover-backdrop/);
assert.match(styles, /\.notification-popover\{/);

console.log('Notification pop-up interaction safeguards passed.');
