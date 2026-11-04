'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const htmlFiles = [
  'apps-script/Bridge.html',
  'apps-script/Index.html',
  'frontend/index.html'
];
const standaloneJsFiles = [
  'frontend/api-bridge.js',
  'frontend/psb-fm-apps-script.js'
];

function fail(file, block, error) {
  console.error(`JavaScript syntax error in ${file}${block ? ` (script block ${block})` : ''}:`);
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
}

function validateClassic(source, filename) {
  try {
    new vm.Script(source, { filename });
  } catch (error) {
    fail(filename, null, error);
  }
}

function validateModule(source, filename) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-module-check-'));
  const tempFile = path.join(dir, 'inline-script.mjs');
  try {
    fs.writeFileSync(tempFile, source, 'utf8');
    const result = spawnSync(process.execPath, ['--check', tempFile], { encoding: 'utf8' });
    if (result.status !== 0) {
      fail(filename, null, new Error((result.stderr || result.stdout || 'Node module syntax check failed').trim()));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function isJavaScriptType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  return !normalized || normalized === 'module' ||
    /^(text|application)\/(javascript|ecmascript)$/.test(normalized) ||
    /^(text|application)\/x-javascript$/.test(normalized);
}

let checkedBlocks = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let block = 0;

  while ((match = scriptTag.exec(html)) !== null) {
    block += 1;
    const attributes = match[1] || '';
    if (/\bsrc\s*=/.test(attributes)) continue;

    const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const type = typeMatch ? (typeMatch[1] || typeMatch[2] || typeMatch[3] || '') : '';
    if (!isJavaScriptType(type)) continue;

    const source = match[2];
    if (!source.trim()) continue;
    const label = `${file}#inline-${block}`;
    if (String(type).trim().toLowerCase() === 'module') validateModule(source, label);
    else validateClassic(source, label);
    checkedBlocks += 1;
  }
}

for (const file of standaloneJsFiles) {
  validateClassic(fs.readFileSync(file, 'utf8'), file);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`JavaScript syntax validation passed: ${checkedBlocks} inline script block(s) and ${standaloneJsFiles.length} standalone file(s).`);
