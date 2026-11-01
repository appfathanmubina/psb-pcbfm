import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const scriptId = process.env.APPS_SCRIPT_ID;
const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

if (!scriptId) throw new Error("GitHub repository variable APPS_SCRIPT_ID belum diatur.");
if (!accessToken) throw new Error("Token sementara Google tidak tersedia dari GitHub OIDC.");

const endpoint = `https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/content`;
const response = await fetch(endpoint, {
  headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Apps Script API menolak permintaan (HTTP ${response.status}). Pastikan Apps Script API aktif dan service account memiliki akses Editor ke project. Detail: ${body.slice(0, 1200)}`);
}

const project = await response.json();
if (project.scriptId !== scriptId) {
  throw new Error("Apps Script API mengembalikan Script ID yang tidak sesuai.");
}

const extensions = { SERVER_JS: ".gs", HTML: ".html", JSON: ".json" };
const liveFiles = new Map();
for (const file of project.files ?? []) {
  const extension = extensions[file.type];
  if (extension) liveFiles.set(file.name + extension, file.source ?? "");
}

const expected = ["Bridge.html", "BridgeServer.gs", "Code.gs"];
let failed = false;
console.log("Perbandingan source repository dengan Apps Script produksi:");

for (const name of expected) {
  const repoPath = join(process.env.GITHUB_WORKSPACE, "apps-script", name);
  let repositorySource;
  try {
    repositorySource = await readFile(repoPath, "utf8");
  } catch {
    console.log(`FAIL  ${name} — tidak ditemukan di repository`);
    failed = true;
    continue;
  }

  if (!liveFiles.has(name)) {
    console.log(`FAIL  ${name} — tidak ditemukan di project produksi`);
    failed = true;
    continue;
  }

  const productionSource = liveFiles.get(name);
  const hash = value => createHash("sha256").update(value, "utf8").digest("hex");
  const repoHash = hash(repositorySource);
  const liveHash = hash(productionSource);

  if (repositorySource === productionSource) {
    console.log(`PASS  ${name} — identik byte-for-byte (SHA-256: ${repoHash})`);
  } else {
    console.log(`FAIL  ${name} — BERBEDA`);
    console.log(`      Repository : ${repoHash}`);
    console.log(`      Produksi   : ${liveHash}`);
    failed = true;
  }
}

if (failed) {
  console.error("REKONSILIASI GAGAL. Tidak ada source yang diubah dan deployment tidak disentuh.");
  process.exit(1);
}
console.log("REKONSILIASI BERHASIL: ketiga file identik. Proses ini hanya membaca source.");
