'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('frontend/app.js', 'utf8');
const css = fs.readFileSync('frontend/styles.css', 'utf8');
const workflow = fs.readFileSync('.github/workflows/validate.yml', 'utf8');

const renderStart = app.indexOf('async function renderApplicants(force=false){');
const renderEnd = app.indexOf('\nfunction filterApplicantTable(){', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'Applicant page renderer boundaries exist');
const render = app.slice(renderStart, renderEnd);
assert.ok(render.indexOf('renderApplicantTable();') < render.indexOf("server('getRegistrationList'"),
  'Applicant page layout must render before the server request');
assert.match(render, /renderApplicantSkeletonTable\(\)/,
  'Initial applicant load must render a table skeleton');
assert.match(render, /state\.applicantHasLoaded=true/,
  'Only a successful response or valid cache marks applicant data as loaded');
assert.match(render, /state\.applicantLoading=false/,
  'Applicant loading state must settle after success or failure');
assert.match(render, /state\.applicantRequestId/,
  'Stale applicant requests must be ignored');

const skeletonStart = app.indexOf('function renderApplicantSkeletonTable(){');
const skeletonEnd = app.indexOf('\nfunction renderApplicantTable(){', skeletonStart);
assert.ok(skeletonStart >= 0 && skeletonEnd > skeletonStart, 'Applicant skeleton renderer exists');
const skeleton = app.slice(skeletonStart, skeletonEnd);
assert.match(skeleton, /length:6/,
  'Initial skeleton must show multiple rows matching the table layout');
assert.match(skeleton, /staff-data-table/,
  'Skeleton must preserve the real table structure');

const loadStart = app.indexOf('async function loadApplicantPage(page){');
const loadEnd = app.indexOf('\nasync function renderDocuments(', loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, 'Applicant pagination loader boundaries exist');
const loader = app.slice(loadStart, loadEnd);
assert.ok(loader.indexOf('renderApplicantTable();') < loader.indexOf("server('getRegistrationList'"),
  'Existing applicant content or skeleton must remain visible while a page is requested');
assert.doesNotMatch(loader, /loading\(true/,
  'Applicant table refresh must not be covered by the global blocking loader');
assert.match(loader, /page:state\.applicantPendingPage,pageSize:50,search,status/,
  'Server-side pagination, search, and status filters must remain intact');
assert.doesNotMatch(loader, /state\.applicantList\s*=\s*\[\]/,
  'Refresh must not clear previously displayed applicant rows');

assert.match(css, /\.applicant-skeleton-block/,
  'Applicant skeleton styles must exist');
assert.match(css, /\.applicant-load-spinner/,
  'Non-blocking loading indicator styles must exist');
assert.match(css, /prefers-reduced-motion:reduce/,
  'Skeleton animation must respect reduced-motion preferences');
assert.match(workflow, /node tests\/applicant-progressive-render\.test\.js/,
  'Applicant progressive-render regression test must run in CI');

console.log('Applicant progressive-render and refresh-preservation safeguards: OK');
