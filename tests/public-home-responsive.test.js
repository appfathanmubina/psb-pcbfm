'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('frontend/styles.css', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const bundle = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
const appsScriptHtml = fs.readFileSync('apps-script/Index.html', 'utf8');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');

assert.match(css, /@media\s*\(min-width:\s*900px\)/, 'Desktop rules must be isolated to wide viewports');
assert.match(css, /\.public-shell\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,1\.6fr\)\s+minmax\(340px,\.82fr\)/s, 'Desktop landing page must use two columns');
assert.match(css, /\.public-main\s*\{[^}]*grid-area:\s*main;\s*display:\s*grid/s, 'Public content must remain grouped in the left column');
assert.match(css, /\.public-login-panel\s*\{[^}]*display:\s*block/s, 'Inline login must be visible on desktop');
assert.match(css, /\/\* Full-width desktop public landing page; mobile sizing remains untouched\. \*\/[\s\S]*?@media \(min-width: 900px\) \{[\s\S]*?\.public-shell \{\s*width: 100%;\s*max-width: none;/, 'Desktop public shell must use the full available viewport width');
assert.match(appsScriptHtml, /\/\* Full-width desktop public landing page; mobile sizing remains untouched\. \*\/[\s\S]*?@media \(min-width: 900px\) \{[\s\S]*?\.public-shell \{\s*width: 100%;\s*max-width: none;/, 'Apps Script desktop public shell must use the full available viewport width');
assert.match(css, /\.public-login-panel\s*\{\s*display:\s*none\s*\}/, 'Inline login must remain hidden outside desktop rules');
assert.match(css, /\.public-main\s*\{\s*display:\s*contents\s*\}/, 'Mobile content flow must preserve its current document order');
assert.match(css, /@media\s*\(min-width:\s*900px\)\s*and\s*\(max-width:\s*1100px\)/, 'Narrow laptop layout must be covered');
assert.match(app, /function publicInlineLoginMarkup\(/, 'PWA inline login markup helper must exist');
assert.match(app, /<form id="loginForm"[^>]*onsubmit="submitLogin\(event\)"/, 'Inline form must reuse existing authentication');
assert.match(app, /id="rememberMe"/, 'Inline login must preserve Remember Me');
assert.match(bundle, /function publicInlineLoginMarkup\(/, 'Apps Script bundle must include inline login');
assert.match(bundle, /onsubmit="submitLogin\(event\)"/, 'Apps Script bundle must reuse the same authentication handler');
assert.match(appsScriptHtml, /\.public-login-panel[\s\S]*?display:\s*block/, 'Apps Script HTML must include desktop login styles');
assert.match(html, /styles\.css\?v=32\.36\.0/, 'HTML must request the refreshed stylesheet');
assert.match(html, /app\.js\?v=32\.46\.0/, 'HTML must request the refreshed frontend script');
assert.match(sw, /const CACHE=['"]psb-pwa-shell-v32-56-0['"]/, 'PWA shell cache must be refreshed');
assert.match(sw, /styles\.css\?v=32\.36\.0/);
assert.match(sw, /app\.js\?v=32\.46\.0/);

assert.match(app, /function publicSocialMarkup\(/, 'PWA public social links must have a reusable markup helper');
assert.match(bundle, /function publicSocialMarkup\(/, 'Apps Script bundle must include public social links markup');
assert.ok(app.includes('</main>\\n    ${publicInlineLoginMarkup()}\\n    ${publicSocialMarkup()}'), 'PWA social links must render after login and outside main content');
assert.ok(bundle.includes('</main>\\n    ${publicInlineLoginMarkup()}\\n    ${publicSocialMarkup()}'), 'Apps Script social links must render after login and outside main content');
assert.match(css, /\\.public-social\\s*\\{\\s*grid-column:\\s*2;\\s*grid-row:\\s*auto;/, 'Desktop social links must occupy the right column below login');
assert.match(appsScriptHtml, /\\.public-social\\s*\\{\\s*grid-column:\\s*2;\\s*grid-row:\\s*auto;/, 'Apps Script desktop social links must occupy the right column below login');

console.log('PSB desktop inline login, social placement, and mobile layout safeguards: OK');
