# Read-only reconciliation of selected production Apps Script files.
# Requires: Node.js, @google/clasp@3.4.1, and a local clasp login.
# No GitHub Secrets are used. Credentials remain in the current Windows user profile.

$ErrorActionPreference = "Stop"

$claspCommand = Get-Command clasp -ErrorAction SilentlyContinue
if (-not $claspCommand) {
    throw "clasp was not found. Install it with: npm install -g @google/clasp@3.4.1"
}

$credentialPath = Join-Path $HOME ".clasprc.json"
if (-not (Test-Path -LiteralPath $credentialPath)) {
    throw "Local clasp credentials were not found. Run 'clasp login' first."
}

try {
    $credentialJson = Get-Content -LiteralPath $credentialPath -Raw | ConvertFrom-Json
    if ($null -eq $credentialJson) { throw "Empty credentials" }
} catch {
    throw "The local .clasprc.json is not valid JSON. Run 'clasp login' again."
}

$scriptId = Read-Host "Masukkan Apps Script ID proyek produksi (bukan Deployment ID)"
if ([string]::IsNullOrWhiteSpace($scriptId)) {
    throw "Apps Script ID wajib diisi."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("psb-apps-script-reconcile-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    $claspConfig = @{
        scriptId = $scriptId.Trim()
        rootDir = "."
        scriptExtensions = @(".gs", ".html", ".js", ".json")
        filePushOrder = @()
    } | ConvertTo-Json -Depth 5

    $configPath = Join-Path $tempDir ".clasp.json"
    [System.IO.File]::WriteAllText($configPath, $claspConfig, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host ""
    Write-Host "Mengambil source produksi ke folder sementara (read-only)..." -ForegroundColor Cyan
    Push-Location $tempDir
    try {
        & $claspCommand.Source pull --force
        if ($LASTEXITCODE -ne 0) {
            throw "clasp pull gagal dengan exit code $LASTEXITCODE. Periksa akun Google dan akses ke proyek Apps Script."
        }
    } finally {
        Pop-Location
    }

    $files = @("Bridge.html", "BridgeServer.gs", "Code.gs")
    $failed = $false

    Write-Host ""
    Write-Host "Perbandingan source repository dengan Apps Script produksi:"
    foreach ($file in $files) {
        $repoFile = Join-Path (Join-Path $repoRoot "apps-script") $file
        $liveFile = Join-Path $tempDir $file

        if (-not (Test-Path -LiteralPath $repoFile)) {
            Write-Host "FAIL  $file — tidak ditemukan di repository" -ForegroundColor Red
            $failed = $true
            continue
        }
        if (-not (Test-Path -LiteralPath $liveFile)) {
            Write-Host "FAIL  $file — tidak ditemukan di proyek produksi" -ForegroundColor Red
            $failed = $true
            continue
        }

        $repoHash = (Get-FileHash -LiteralPath $repoFile -Algorithm SHA256).Hash
        $liveHash = (Get-FileHash -LiteralPath $liveFile -Algorithm SHA256).Hash
        if ($repoHash -eq $liveHash) {
            Write-Host "PASS  $file — identik (SHA-256: $repoHash)" -ForegroundColor Green
        } else {
            Write-Host "FAIL  $file — BERBEDA" -ForegroundColor Red
            Write-Host "      Repository : $repoHash"
            Write-Host "      Produksi   : $liveHash"
            $failed = $true
        }
    }

    Write-Host ""
    if ($failed) {
        Write-Host "REKONSILIASI GAGAL. Tidak ada source yang di-push dan tidak ada deployment yang diubah." -ForegroundColor Red
        exit 1
    }

    Write-Host "REKONSILIASI BERHASIL: ketiga file identik byte-for-byte." -ForegroundColor Green
    Write-Host "Proses ini hanya membaca source; tidak melakukan push atau deployment."
} finally {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
