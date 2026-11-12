'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('frontend/styles.css', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');
const bundle = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
const appsScriptHtml = fs.readFileSync('apps-script/Index.html', 'utf8');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');
const styleStart = appsScriptHtml.indexOf('<style>');
const styleEnd = appsScriptHtml.indexOf('</style>', styleStart);
const appsScriptStyle = styleStart >= 0 && styleEnd > styleStart ? appsScriptHtml.slice(styleStart + 7, styleEnd) : '';

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
assert.match(html, /styles\.css\?v=32\.39\.0/, 'HTML must request the refreshed stylesheet');
assert.match(html, /app\.js\?v=32\.48\.0/, 'HTML must request the refreshed frontend script');
assert.match(sw, /const CACHE=['"]psb-pwa-shell-v32-60-0['"]/, 'PWA shell cache must be refreshed');
assert.match(sw, /styles\.css\?v=32\.39\.0/);
assert.match(sw, /app\.js\?v=32\.48\.0/);

assert.match(app, /function publicSocialMarkup\(/, 'PWA public social links must have a reusable markup helper');
assert.match(bundle, /function publicSocialMarkup\(/, 'Apps Script bundle must include public social links markup');
assert.ok(app.includes('</main>\n    ${publicInlineLoginMarkup()}'), 'PWA login column must follow the public content');
assert.ok(bundle.includes('</main>\n    ${publicInlineLoginMarkup()}'), 'Apps Script login column must follow the public content');
assert.match(app, /<section class="public-login-column" aria-label="Masuk dan media sosial"><aside class="public-login-panel"[\s\S]*?<\/aside>\$\{publicSocialMarkup\(\)\}<\/section>/, 'PWA social links must be nested in the shared login section after the login panel');
assert.match(bundle, /<section class="public-login-column" aria-label="Masuk dan media sosial"><aside class="public-login-panel"[\s\S]*?<\/aside>\$\{publicSocialMarkup\(\)\}<\/section>/, 'Apps Script social links must be nested in the shared login section after the login panel');
assert.match(css, /\.public-login-column\s*\{\s*grid-area:\s*login;/, 'Desktop login and social group must occupy the right column');
assert.match(css, /\.public-login-column\s*\{\s*display:\s*contents\s*\}/, 'Mobile login/social group must preserve document flow');
assert.match(css, /\.public-social\s*\{\s*grid-column:\s*auto;/, 'Social links must stay inside the login column, not be independently placed');
assert.match(appsScriptHtml, /\.public-login-column\s*\{\s*grid-area:\s*login;/, 'Apps Script login/social group must occupy the right column');
assert.match(appsScriptHtml, /psb-fm-apps-script\.js\?v=20261111-6/, 'Apps Script must request the corrected social placement bundle');
const socialLayoutRule = /\/\* Keep login and social links in one right-column group[\s\S]*?^\}/m;
assert.equal(css.match(socialLayoutRule)?.[0], appsScriptStyle.match(socialLayoutRule)?.[0], 'PWA and Apps Script social-column layout rules must stay identical');


assert.match(css, /\.public-login-column\s*\{[\s\S]*?grid-area:\s*login;[\s\S]*?display:\s*flex;[\s\S]*?border-radius:\s*24px;/, 'Desktop login and social links must share one outer card');
assert.match(css, /\.public-login-panel\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/, 'Login panel must not render as a separate card inside the shared card');
assert.match(css, /\.public-social\s*\{[\s\S]*?grid-column:\s*auto;[\s\S]*?border-top:\s*1px solid/, 'Social links must sit below login with a subtle divider inside the shared card');
assert.match(appsScriptStyle, /\.public-login-column\s*\{[\s\S]*?grid-area:\s*login;[\s\S]*?display:\s*flex;[\s\S]*?border-radius:\s*24px;/, 'Apps Script must use the same shared desktop login/social card');
assert.match(app, /<section class="public-login-column" aria-label="Masuk dan media sosial"><aside class="public-login-panel"[\s\S]*?<\/aside>\$\{publicSocialMarkup\(\)\}<\/section>/, 'PWA login and social links must share one semantic section');
assert.match(bundle, /<section class="public-login-column" aria-label="Masuk dan media sosial"><aside class="public-login-panel"[\s\S]*?<\/aside>\$\{publicSocialMarkup\(\)\}<\/section>/, 'Apps Script login and social links must share one semantic section');

console.log('PSB desktop shared login/social card and mobile layout safeguards: OK');
