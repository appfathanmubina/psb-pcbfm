'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const invite = 'https://chat.whatsapp.com/LxzCITtPdz47vI4lVOfqHs?s=cl&amp;p=a&amp;iam=2';
for (const path of ['frontend/app.js', 'frontend/psb-fm-apps-script.js']) {
  const app = fs.readFileSync(path, 'utf8');
  assert.ok(app.includes('function whatsappGroupButtonMarkup()'), path + ' must define the compact floating WhatsApp CTA');
  assert.ok(app.includes('function syncWhatsAppGroupFab(visible)'), path + ' must manage the floating CTA lifecycle');
  assert.ok(app.includes(invite), path + ' must use the supplied WhatsApp group invite');
  assert.match(app, /syncWhatsAppGroupFab\(true\)/, path + ' must show the CTA on the public first page');
  assert.match(app, /syncWhatsAppGroupFab\(page==='home'\|\|page==='profile'\)/, path + ' must show the CTA on dashboard and profile and hide it elsewhere');
  assert.match(app, /<strong>Grup<\/strong>/, path + ' must use the short Grup label');
  assert.match(app, /target="_blank" rel="noopener noreferrer"/, path + ' must open the group safely in a new tab');
  assert.doesNotMatch(app, /whatsappGroupButtonMarkup\('(public|dashboard|profile)'\)/, path + ' must not render the old inline WhatsApp cards');
}
for (const path of ['frontend/styles.css', 'apps-script/Index.html']) {
  const css = fs.readFileSync(path, 'utf8');
  assert.match(css, /\.whatsapp-group-fab\s*\{/, path + ' must position the floating WhatsApp shortcut');
  assert.match(css, /bottom:calc\(82px \+ env\(safe-area-inset-bottom\)\)/, path + ' must keep the shortcut above the mobile bottom navigation');
  assert.match(css, /\.whatsapp-group-fab:focus-visible/, path + ' must keep the floating shortcut keyboard accessible');
}
console.log('Floating WhatsApp group shortcut on public home, dashboard, and profile: OK');
