'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('frontend/app.js','utf8');
const css = fs.readFileSync('frontend/styles.css','utf8');
const pages = [
 ['renderHome','dashboardPanel'],['renderSelection','selectionPanel'],
 ['renderAnnouncements','announcementPanel'],['renderReregistration','reregPanel'],
 ['renderPayments','paymentPanel'],['renderVerification','verificationPanel'],
 ['renderDocuments','documentPanel'],['renderNotifications','notificationPanel'],
 ['renderMasterData','masterPanel'],['renderReports','reportPanel'],
 ['renderAudit','auditPanel'],['renderUserManagementPage','userManagementPageBody'],
 ['renderRegistrationHub','registrationPanel']
];
assert.match(app,/function progressivePanelMarkup\(/,'Shared progressive panel renderer exists');
assert.match(app,/progressive-panel-refresh/,'Refresh indicator retains existing content');
assert.match(app,/progressive-panel-skeleton/,'First load gets skeleton placeholders');
for(const [fn,panel] of pages){
 const start=app.indexOf('function '+fn+'(')>=0?app.indexOf('function '+fn+'('):app.indexOf('async function '+fn+'(');
 assert.ok(start>=0,fn+' exists');
 const endCandidates=[app.indexOf('\nfunction ',start+10),app.indexOf('\nasync function ',start+10)].filter(x=>x>start);
 const end=endCandidates.length?Math.min(...endCandidates):app.length;
 const body=app.slice(start,end);
 assert.ok(body.includes("progressivePanelMarkup('"+panel+"'"),fn+' renders progressive panel '+panel);
}
assert.match(css,/\.progressive-panel-skeleton/,'Progressive skeleton styles exist');
assert.match(css,/prefers-reduced-motion:reduce/,'Reduced motion is respected');
console.log('Operational pages progressive loading safeguards: OK');
