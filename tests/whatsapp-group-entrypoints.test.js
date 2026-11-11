'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const invite = 'https://chat.whatsapp.com/LxzCITtPdz47vI4lVOfqHs?s=cl&amp;p=a&amp;iam=2';
for (const path of ['frontend/app.js', 'frontend/psb-fm-apps-script.js']) {
  const app = fs.readFileSync(path, 'utf8');
  assert.ok(app.includes('function whatsappGroupButtonMarkup('), path + ' must define the shared WhatsApp CTA');
  assert.ok(app.includes(invite), path + ' must use the supplied WhatsApp group invite');
  assert.match(app, /whatsappGroupButtonMarkup\('public'\)/, path + ' must show the CTA on the public first page');
  assert.match(app, /whatsappGroupButtonMarkup\('dashboard'\)/, path + ' must show the CTA on the dashboard');
  assert.match(app, /whatsappGroupButtonMarkup\('profile'\)/, path + ' must show the CTA on the profile');
  assert.match(app, /target="_blank" rel="noopener noreferrer"/, path + ' must open the group safely in a new tab');
}
for (const path of ['frontend/styles.css', 'apps-script/Index.html']) {
  const css = fs.readFileSync(path, 'utf8');
  assert.match(css, /\.whatsapp-group-link--public/, path + ' must style the public CTA');
  assert.match(css, /\.whatsapp-group-icon/, path + ' must style the WhatsApp icon');
  assert.match(css, /:focus-visible/, path + ' must keep the CTA keyboard accessible');
}
console.log('WhatsApp group links on public home, dashboard, and profile: OK');
