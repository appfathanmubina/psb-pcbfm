'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sources = [
  ['PWA', fs.readFileSync('frontend/app.js', 'utf8')],
  ['Apps Script bundle', fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8')]
];

for (const [label, source] of sources) {
  const start = source.indexOf('function dashboardTaskItems(items, emptyText){');
  const end = source.indexOf('\nfunction renderDashboardSchedule(', start);
  assert.notEqual(start, -1, label + ' dashboard task renderer exists');
  assert.ok(end > start, label + ' dashboard task renderer boundary exists');
  const context = {
    esc: value => String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[char])),
    formatRupiah: value => 'Rp' + Number(value).toLocaleString('id-ID')
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const html = context.dashboardTaskItems([{
    candidateName: 'Calon Satu', registrationNumber: 'PSB-001',
    label: 'Bukti pembayaran menunggu verifikasi', statusLabel: 'Dikirim',
    amount: 150000, action: 'payments'
  }]);
  assert.match(html, /PSB-001/, label + ' shows registration number');
  assert.match(html, /Bukti pembayaran menunggu verifikasi/,
    label + ' shows task reason alongside registration number');
  assert.match(html, /Dikirim/, label + ' retains status context');
  assert.match(html, /Rp150\.000/, label + ' retains payment amount');
  assert.match(html, /aria-label="Buka Bukti pembayaran menunggu verifikasi untuk Calon Satu"/,
    label + ' provides a descriptive accessible action label');
  assert.match(html, /goPage\('payments'\)/, label + ' preserves intended destination');
}
console.log('PSB dashboard task context and accessibility safeguards: OK');
