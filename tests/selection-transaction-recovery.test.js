'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(start, end, label) {
  const a = backend.indexOf(start);
  assert.notEqual(a, -1, label + ' start exists');
  const b = backend.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary exists');
  return backend.slice(a, b);
}

const publish = section(
  'function publishAnnouncement(sessionToken,payload) {',
  '\nfunction getNotifications(sessionToken)',
  'Announcement publishing'
);
assert.match(publish, /const expectedStatus=latestStatus==='PASSED'\?'REREGISTRATION':latestStatus==='NOT_PASSED'\?'NOT_PASSED':'SELECTION'/,
  'Expected follow-up status must be derived from the stored selection result');
assert.match(publish, /if\(!alreadyPublished && !\['SELECTION','PASSED',expectedStatus\]\.includes\(currentRegStatus\)\)/,
  'A retry must allow the matching registration status after a partial announcement commit');
assert.ok(publish.indexOf('setRegistrationStatus_(latestReg.registration,nextStatus') < publish.indexOf('resultSheet.getRange(latest.rowNumber,dateIdx+1).setValue(now)'),
  'Announcement marker must remain the final state commit after follow-up state is ready');

assert.match(publish, /passedWorkflowAdvanced=latestStatus==='PASSED' && \['REREGISTRATION','PAYMENT_VERIFIED','COMPLETED'\]\.includes\(currentRegStatus\)/,
  'A published PASS result must recognize downstream re-registration and completion states');
assert.match(publish, /if\(currentRegStatus!==nextStatus && !passedWorkflowAdvanced\)/,
  'Repeated PASS announcements must not downgrade a registration that advanced beyond REREGISTRATION');
assert.match(publish, /if\(passedWorkflowAdvanced\)[\s\S]*?existingReregistration=findRowById_/,
  'A repeated PASS announcement in an advanced state must confirm the existing re-registration row');
assert.match(publish, /const confirmed=findRegistration_\(registrationId\)/,
  'A registration status transition during publication must be confirmed by a fresh read');

const scheduleStatus = section(
  'function updateSelectionScheduleStatus(sessionToken,payload){',
  '\nfunction addSelectionParticipant(sessionToken,payload){',
  'Schedule status update'
);
assert.ok(scheduleStatus.indexOf('lock.waitLock(') >= 0 && scheduleStatus.indexOf('findRowById_(') > scheduleStatus.indexOf('lock.waitLock('),
  'Schedule status changes must serialize with participant assignment');
assert.match(scheduleStatus, /finally\{lock\.releaseLock\(\);\}/,
  'Schedule status update must always release its lock');

const single = section(
  'function addSelectionParticipant(sessionToken,payload){',
  '\nfunction addSelectionParticipantsBulk(sessionToken,payload){',
  'Single participant assignment'
);
const singleLock = single.indexOf('lock.waitLock(');
assert.ok(singleLock >= 0, 'Single participant assignment must acquire ScriptLock');
for (const token of ['findRegistration_(registrationId)', 'isRegistrationSelectionEligible_(registrationId)', "findRowById_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE),'scheduleId',scheduleId)", "sheetRowsMatchingValues_(sheet,'registrationId',[registrationId])"]) {
  assert.ok(single.indexOf(token) > singleLock, token + ' must be revalidated under ScriptLock');
}
assert.match(single, /findRowById_\(sheet,'participantId',record\.participantId\)/,
  'Single participant write must be confirmed by a fresh read before success');
assert.match(single, /catch\(notificationError\)/,
  'Notification failure after participant commit must not turn a committed assignment into an apparent failure');

const bulk = section(
  'function addSelectionParticipantsBulk(sessionToken,payload){',
  '\nfunction updateSelectionParticipantStatus(sessionToken,payload){',
  'Bulk participant assignment'
);
const bulkLock = bulk.indexOf('lock.waitLock(');
const bulkSchedule = bulk.indexOf("schedule=findRowById_(ss.getSheetByName(PSB_SHEETS.SELECTION_SCHEDULE),'scheduleId',scheduleId)");
assert.ok(bulkLock >= 0 && bulkSchedule > bulkLock,
  'Bulk participant generation must re-read schedule state under ScriptLock');
assert.ok(bulk.indexOf('findRegistration_(registrationId)') > bulkLock &&
  bulk.indexOf('isRegistrationSelectionEligible_(registrationId)') > bulkLock,
  'Bulk participant generation must revalidate each registration under ScriptLock');
assert.match(bulk, /finally\{lock\.releaseLock\(\)\}/,
  'Bulk participant generation must always release its lock');

const participantStatus = section(
  'function updateSelectionParticipantStatus(sessionToken,payload){',
  '\\nfunction saveSelectionScore(sessionToken,payload){',
  'Participant status update'
);
assert.match(participantStatus, /if\\(idx<0\\)return fail_/,
  'Participant status update must fail clearly when the required status column is missing');
assert.match(participantStatus, /findRowById_\\(sheet,'participantId',participantId\\)/,
  'Participant status update must re-read the participant after writing');
assert.match(participantStatus, /confirmed\\.object\\.status\\|\\|''\\)\\.toUpperCase\\(\\)!==status/,
  'Participant status update must compare the persisted status with the requested status');
assert.match(participantStatus, /catch\\(auditError\\)/,
  'Audit logging failure after a confirmed participant status write must not mask the committed update');

const verification = section(
  'function finalizeVerification(sessionToken, payload) {',
  '\\nfunction setRegistrationStatus_(',
  'Registration verification finalization'
);
assert.match(verification, /catch\\(notificationError\\)/,
  'Notification failure after registration verification must not turn the committed decision into an apparent failure');
assert.ok(verification.indexOf('catch(notificationError)') > verification.indexOf('setRegistrationStatus_('),
  'Verification notification isolation must occur after the registration status transition');

console.log('Selection transaction recovery safeguards: OK');
