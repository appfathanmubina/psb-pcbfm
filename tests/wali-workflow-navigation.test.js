'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const shell = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
const css = fs.readFileSync('frontend/styles.css', 'utf8');

for (const [name, source] of [['PWA', app], ['Apps Script shell', shell]]) {
  assert.match(source, /WALI:\['home','registration','payments','documents'\]/,
    name + ': Wali bottom navigation must show Beranda, Pendaftaran, Dokumen, Pembayaran, then Lainnya');
  assert.match(source, /\['more','Lainnya','settings'\]/,
    name + ': Wali navigation must keep a fifth More button');
  assert.match(source, /const stageActions=\['registration','payments','documents','verification','selection','announcement','reregistration'\]/,
    name + ': all seven workflow stages must map to their matching pages');
  assert.match(source, /class=\"wali-flow-item wali-flow-clickable[^\"]*\" onclick=\"waliFlowAction\(/,
    name + ': each Wali flow stage must be a real clickable button');
  assert.match(source, /async function renderWaliVerificationStatus\(\)/,
    name + ': Wali needs a separate verification-status page');
  assert.match(source, /server\('getWaliHomeData',state\.token\)/,
    name + ': Wali verification status must use Wali-scoped data');
  assert.match(source, /const items=\[\s*\['verificationStatus','Verifikasi'/,
    name + ': Wali More menu must begin with Verifikasi');
  assert.match(source, /\['selection','Tes'/,
    name + ': Wali More menu must include Tes');
  assert.match(source, /\['announcement','Pengumuman'/,
    name + ': Wali More menu must include Pengumuman');
  assert.match(source, /\['reregistration','Daftar Ulang'/,
    name + ': Wali More menu must include Daftar Ulang');
  assert.match(source, /waliMorePages=\['verificationStatus','selection','announcement','reregistration'\]/,
    name + ': More must remain active while its submenus are open');
}
assert.match(css, /\.header-action\{[^}]*overflow:visible/,
  'Header action must not clip the notification badge');
assert.match(css, /\.notification-badge\{[^}]*z-index:3[^}]*min-width:22px[^}]*height:22px/,
  'Notification badge must have enough room for multi-digit counts');
console.log('Wali workflow navigation and notification badge safeguards: OK');

for (const [name, source] of [['PWA', app], ['Apps Script shell', shell]]) {
  const home = source.slice(source.indexOf('function renderWaliHomeFlow(data){'), source.indexOf('function dashboardTaskItems(items, emptyText)'));
  assert.doesNotMatch(home, /wali-flow-parallel|wali-flow-current|wali-flow-next/, name + ': Wali home must not repeat workflow details below the clickable stages');
  assert.match(home, /wali-flow-list/, name + ': clickable registration workflow remains visible');
  assert.doesNotMatch(source, /File fisik disimpan di folder Google Drive pendaftaran\. Spreadsheet hanya menyimpan metadata file, status, dan jejak audit\./, name + ': internal Drive/audit note must not be shown on the document page');
}
console.log('Wali home information hierarchy safeguards: OK');
