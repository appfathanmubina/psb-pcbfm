#!/usr/bin/env bash
set -euo pipefail

: "${SCRIPT_ID:?SCRIPT_ID secret is required}"
if [[ ! "$SCRIPT_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "SCRIPT_ID has an unexpected format." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL_DIR="$ROOT_DIR/apps-script"
REMOTE_DIR="$(mktemp -d)"
trap 'rm -rf "$REMOTE_DIR"' EXIT

test -d "$LOCAL_DIR"
printf '{"scriptId":"%s","rootDir":"."}\n' "$SCRIPT_ID" > "$REMOTE_DIR/.clasp.json"
(cd "$REMOTE_DIR" && clasp pull --force)

find "$LOCAL_DIR" -maxdepth 1 -type f \( -name '*.gs' -o -name '*.html' -o -name 'appsscript.json' \) -printf '%f\n' | sort > "$REMOTE_DIR/local-files.txt"
find "$REMOTE_DIR" -maxdepth 1 -type f \( -name '*.gs' -o -name '*.html' -o -name 'appsscript.json' \) -printf '%f\n' | sort > "$REMOTE_DIR/remote-files.txt"

if ! diff -u "$REMOTE_DIR/remote-files.txt" "$REMOTE_DIR/local-files.txt"; then
  echo "Apps Script file sets differ. Push blocked to prevent accidental additions or deletions." >&2
  exit 1
fi

node -e 'const fs=require("fs"); const {isDeepStrictEqual}=require("util"); const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); if(!isDeepStrictEqual(a,b)){ console.error("Apps Script manifest differs from remote; push blocked."); process.exit(1); }' "$LOCAL_DIR/appsscript.json" "$REMOTE_DIR/appsscript.json"

echo "=== REVIEW: repository changes versus current Apps Script source ==="
DIFF_FOUND=0
while IFS= read -r file; do
  [[ "$file" == "appsscript.json" ]] && continue
  if ! cmp -s "$LOCAL_DIR/$file" "$REMOTE_DIR/$file"; then
    DIFF_FOUND=1
    echo
    echo "----- CHANGE: $file -----"
    diff -u --label "Apps Script online/$file" --label "Repository/$file" "$REMOTE_DIR/$file" "$LOCAL_DIR/$file" || true
  fi
done < "$REMOTE_DIR/local-files.txt"

if [[ "$DIFF_FOUND" -eq 0 ]]; then
  echo "No source content differences found."
else
  echo
  echo "Source differences are shown above. The workflow may continue only because the operator explicitly entered PUSH and the production Environment approved this run."
fi
