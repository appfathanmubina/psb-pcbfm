#!/usr/bin/env bash
set -Eeuo pipefail
set +x

: "${APPS_SCRIPT_ID:?Missing APPS_SCRIPT_ID GitHub Environment secret}"
: "${CLASPRC_JSON:?Missing CLASPRC_JSON GitHub Environment secret}"

ROOT_DIR="$(git rev-parse --show-toplevel)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Keep clasp credentials outside the checkout and restrict their permissions.
umask 077
printf '%s' "$CLASPRC_JSON" > "$HOME/.clasprc.json"
chmod 600 "$HOME/.clasprc.json"

# Clone/pull into an isolated temporary directory; never write into repository source.
node -e 'const fs=require("fs"); fs.writeFileSync(process.argv[1], JSON.stringify({scriptId:process.env.APPS_SCRIPT_ID,rootDir:".",scriptExtensions:[".gs",".html",".js",".json"],filePushOrder:[]}));' "$TMP_DIR/.clasp.json"

echo "Pulling live Apps Script source into an isolated temporary directory (read-only)..."
(cd "$TMP_DIR" && clasp pull --force)

FILES=("Bridge.html" "BridgeServer.gs" "Code.gs")
FAILED=0
echo
echo "Exact source comparison (repository vs production Apps Script):"
for file in "${FILES[@]}"; do
  local_file="$ROOT_DIR/apps-script/$file"
  remote_file="$TMP_DIR/$file"

  if [[ ! -f "$local_file" ]]; then
    echo "FAIL  $file — missing from repository"
    FAILED=1
    continue
  fi
  if [[ ! -f "$remote_file" ]]; then
    echo "FAIL  $file — missing from production project"
    FAILED=1
    continue
  fi

  local_hash="$(sha256sum "$local_file" | awk '{print $1}')"
  remote_hash="$(sha256sum "$remote_file" | awk '{print $1}')"
  if cmp -s "$local_file" "$remote_file"; then
    echo "PASS  $file — byte-for-byte identical (sha256: $local_hash)"
  else
    echo "FAIL  $file — DIFFERENT"
    echo "      repository sha256: $local_hash"
    echo "      production sha256: $remote_hash"
    FAILED=1
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  echo
  echo "RECONCILIATION FAILED. No source was pushed and no deployment was changed."
  exit 1
fi

echo
echo "RECONCILIATION PASSED: all three requested files are byte-for-byte identical."
echo "This workflow did not push source or create/update any deployment."
