'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const shell = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
for (const [name, source] of [['PWA', app], ['Apps Script shell', shell]]) {
  const start=source.indexOf('async function renderAnnouncements(force=false)'),end=source.indexOf('\nfunction announcementStatusLabel',start);
  assert.ok(start>=0&&end>start,name+': announcement renderer must exist');
  const loader=source.slice(start,end);
  assert.match(loader,/const isWali=hasAnyRole\(\['WALI'\]\)/);
  assert.match(loader,/loadPageData\('selection','getSelectionPageData'\)/);
  assert.match(loader,/loadPageData\('reregistration','getReregistrationPageData'\)/);
  const ps=source.indexOf('function renderAnnouncementPanel(data,waliData=null)'),pe=source.indexOf('\nfunction ',ps+10),p=source.slice(ps,pe);
  const a=p.indexOf('Informasi Tes'),b=p.indexOf('Informasi Pengumuman'),c=p.indexOf('Informasi Daftar Ulang');
  assert.ok(a>=0&&b>a&&c>b,name+': order must be Tes, Pengumuman, Daftar Ulang');
  assert.match(p,/renderSelectionWali\(waliData\.selection,selectionEl\)/);
  assert.match(p,/renderReregistrationPanel\(waliData\.reregistration,reregEl\)/);
  assert.match(source,/function renderSelectionWali\(data,targetEl=null\)/);
  assert.match(source,/function renderReregistrationPanel\(data,targetEl=null\)/);
}
console.log('Wali announcement combined workflow information safeguards: OK');
