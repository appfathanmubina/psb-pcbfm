import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, ".github/apps-script-config.json"), "utf8"));
const SCRIPT_ID = CONFIG.scriptId;
const SOURCE_DIR = path.join(ROOT, CONFIG.sourceDir);
const EXCLUDED = new Set(CONFIG.excludedFiles || []);
const REQUIRED_SECRETS = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN"];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

for (const key of REQUIRED_SECRETS) {
  if (!process.env[key]) fail(`Missing GitHub Actions secret: ${key}`);
}
if (!SCRIPT_ID || !fs.existsSync(SOURCE_DIR)) fail("Apps Script project configuration/source directory is invalid.");

async function refreshAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    fail(`Google OAuth token exchange failed (HTTP ${response.status}). Check the three OAuth secrets and their granted scopes.`);
  }
  return data.access_token;
}

async function api(accessToken, endpoint, options = {}) {
  const response = await fetch(`https://script.googleapis.com/v1/projects/${encodeURIComponent(SCRIPT_ID)}${endpoint}`, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    const detail = data.error?.message || `HTTP ${response.status}`;
    fail(`Apps Script API request failed: ${detail}`);
  }
  return data;
}

function sourceFiles() {
  const names = fs.readdirSync(SOURCE_DIR).filter(name => !EXCLUDED.has(name)).sort();
  const files = [];
  for (const filename of names) {
    const fullPath = path.join(SOURCE_DIR, filename);
    if (!fs.statSync(fullPath).isFile()) continue;
    const ext = path.extname(filename).toLowerCase();
    const name = path.basename(filename, ext);
    let type;
    if (ext === ".gs") type = "SERVER_JS";
    else if (ext === ".html") type = "HTML";
    else if (ext === ".json" && filename === "appsscript.json") type = "JSON";
    else continue;
    files.push({ name: filename === "appsscript.json" ? "appsscript" : name, type, source: fs.readFileSync(fullPath, "utf8") });
  }
  if (!files.some(file => file.name === "appsscript" && file.type === "JSON")) fail("Required Apps Script manifest appsscript.json is missing.");
  for (const required of ["Code", "Index", "SetupDatabase", "Bridge", "BridgeServer"]) {
    if (!files.some(file => file.name === required)) fail(`Required source file is missing: ${required}`);
  }
  return files;
}

async function pushContent(accessToken) {
  // updateContent replaces the complete Apps Script project. Block if the live project
  // contains a file that is not represented by this repository, to prevent silent deletion.
  const remote = await api(accessToken, "/content");
  const localFiles = sourceFiles();
  const localNames = new Set(localFiles.map(file => file.name));
  const remoteExtras = (remote.files || []).map(file => file.name).filter(name => !localNames.has(name));
  if (remoteExtras.length) {
    fail(`PUSH dibatalkan agar tidak menghapus file yang hanya ada di Apps Script: ${remoteExtras.join(", ")}. Audit/reconcile file tersebut terlebih dahulu.`);
  }
  await api(accessToken, "/content", {
    method: "PUT",
    body: JSON.stringify({ files: localFiles })
  });
  console.log(`PUSH berhasil: ${localFiles.length} file source dikirim ke Apps Script project ${SCRIPT_ID}.`);
}

async function deployExisting(accessToken) {
  const deploymentId = process.env.PRODUCTION_DEPLOYMENT_ID;
  if (!deploymentId) fail("Missing GitHub Actions secret: PRODUCTION_DEPLOYMENT_ID");

  // Always upload the checked-in source first, so the version matches this commit.
  await pushContent(accessToken);

  const current = await api(accessToken, `/deployments/${encodeURIComponent(deploymentId)}`);
  if (current.deploymentConfig?.scriptId && current.deploymentConfig.scriptId !== SCRIPT_ID) {
    fail("Deployment ID belongs to a different Apps Script project. Deployment was not changed.");
  }

  const version = await api(accessToken, "/versions", {
    method: "POST",
    body: JSON.stringify({ description: `GitHub Actions ${process.env.GITHUB_SHA || "manual"}` })
  });
  if (!version.versionNumber) fail("Apps Script did not return a new version number.");

  const updated = await api(accessToken, `/deployments/${encodeURIComponent(deploymentId)}`, {
    method: "PUT",
    body: JSON.stringify({
      deploymentConfig: {
        scriptId: SCRIPT_ID,
        versionNumber: version.versionNumber,
        description: `PSB production deployment from GitHub ${(process.env.GITHUB_SHA || "").slice(0, 7)}`
      }
    })
  });
  if (updated.deploymentId && updated.deploymentId !== deploymentId) {
    fail("Apps Script returned an unexpected deployment ID. Verify deployment status before proceeding.");
  }
  console.log(`DEPLOY berhasil: versi ${version.versionNumber} diterapkan pada deployment ID yang sudah ada.`);
  if (updated.entryPoints?.[0]?.webApp?.url) console.log(`Web App URL: ${updated.entryPoints[0].webApp.url}`);
}

const action = process.argv[2];
if (!["push", "deploy"].includes(action)) fail("Usage: node .github/scripts/apps-script-api.mjs push|deploy");
const token = await refreshAccessToken();
if (action === "push") await pushContent(token);
else await deployExisting(token);
