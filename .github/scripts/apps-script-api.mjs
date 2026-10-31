#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const API = "https://script.googleapis.com/v1";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing required GitHub Secret/environment variable: ${name}`);
  return value.trim();
}

function safeId(value, name) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${name} has an unexpected format.`);
  return value;
}

async function getAccessToken() {
  const clientId = required("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = required("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = required("GOOGLE_OAUTH_REFRESH_TOKEN");

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const reason = data.error === "invalid_grant"
      ? "Google rejected the refresh token. Re-authorize the OAuth client and update GOOGLE_OAUTH_REFRESH_TOKEN."
      : (data.error_description || data.error || "No access token returned");
    throw new Error(`Google OAuth token refresh failed (${response.status}): ${reason}`);
  }
  return data.access_token;
}

async function apiRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = {};
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { throw new Error(`Apps Script API returned non-JSON response (${response.status}).`); }
  }
  if (!response.ok) {
    const message = data.error?.message || `HTTP ${response.status}`;
    throw new Error(`Apps Script API request failed: ${message}`);
  }
  return data;
}

async function readProjectFiles() {
  const dir = path.resolve("apps-script");
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  const seen = new Set();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filename = entry.name;
    let type;
    let name;
    if (filename === "appsscript.json") {
      type = "JSON";
      name = "appsscript";
    } else if (filename.endsWith(".gs")) {
      type = "SERVER_JS";
      name = filename.slice(0, -3);
    } else if (filename.endsWith(".html")) {
      type = "HTML";
      name = filename.slice(0, -5);
    } else {
      continue;
    }
    if (seen.has(name)) throw new Error(`Duplicate Apps Script file basename: ${name}`);
    seen.add(name);
    files.push({ name, type, source: await fs.readFile(path.join(dir, filename), "utf8") });
  }

  if (!files.some(file => file.name === "appsscript" && file.type === "JSON")) {
    throw new Error("apps-script/appsscript.json is missing.");
  }
  for (const requiredName of ["Code", "Index", "SetupDatabase", "Bridge", "BridgeServer"]) {
    if (!seen.has(requiredName)) throw new Error(`Required Apps Script source is missing: ${requiredName}`);
  }
  return files;
}

async function pushProject(token, scriptId) {
  const files = await readProjectFiles();
  const result = await apiRequest(token, `${API}/projects/${scriptId}/content`, {
    method: "PUT",
    body: JSON.stringify({ files })
  });
  if (!Array.isArray(result.files)) throw new Error("Apps Script API did not confirm the updated project file list.");
  console.log(`Apps Script source uploaded successfully: ${result.files.length} files.`);
}

async function deployExisting(token, scriptId, deploymentId) {
  const deploymentUrl = `${API}/projects/${scriptId}/deployments/${deploymentId}`;
  const current = await apiRequest(token, deploymentUrl);
  const config = current.deploymentConfig;
  if (!config) throw new Error("The configured deployment was not found or has no deployment configuration.");

  const sha = process.env.GITHUB_SHA || "manual";
  const description = `GitHub Actions ${sha}`;
  const version = await apiRequest(token, `${API}/projects/${scriptId}/versions`, {
    method: "POST",
    body: JSON.stringify({ description })
  });
  if (!version.versionNumber) throw new Error("Apps Script API did not return a new version number.");

  const updated = await apiRequest(token, deploymentUrl, {
    method: "PUT",
    body: JSON.stringify({
      deploymentConfig: {
        scriptId,
        versionNumber: version.versionNumber,
        manifestFileName: config.manifestFileName || "appsscript",
        description
      }
    })
  });
  if (updated.deploymentId !== deploymentId) {
    throw new Error("Deployment response did not match the configured existing deployment ID.");
  }
  console.log(`Existing Apps Script deployment updated. Version: ${version.versionNumber}; deployment ID unchanged.`);
}

async function main() {
  const mode = process.argv[2];
  if (!["push", "deploy"].includes(mode)) throw new Error("Usage: node .github/scripts/apps-script-api.mjs <push|deploy>");
  const scriptId = safeId(required("APPS_SCRIPT_ID"), "APPS_SCRIPT_ID");
  const token = await getAccessToken();

  if (mode === "push") {
    await pushProject(token, scriptId);
    return;
  }
  const deploymentId = safeId(required("PRODUCTION_DEPLOYMENT_ID"), "PRODUCTION_DEPLOYMENT_ID");
  await deployExisting(token, scriptId, deploymentId);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
