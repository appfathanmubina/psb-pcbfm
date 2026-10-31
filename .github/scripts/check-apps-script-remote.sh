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

diff -u "$REMOTE_DIR/local-files.txt" "$REMOTE_DIR/remote-files.txt" || {
  echo "Apps Script local/remote file sets differ; operation blocked." >&2
  exit 1
}

while IFS= read -r file; do
  if [[ "$file" == "appsscript.json" ]]; then
    node -e 'const fs=require("fs"); const {isDeepStrictEqual}=require("util"); const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8")); if(!isDeepStrictEqual(a,b)){ console.error("Apps Script manifest differs from remote."); process.exit(1); }' "$LOCAL_DIR/$file" "$REMOTE_DIR/$file"
  else
    cmp -s "$LOCAL_DIR/$file" "$REMOTE_DIR/$file" || {
      echo "Apps Script source differs from remote: $file; operation blocked." >&2
      diff -u "$LOCAL_DIR/$file" "$REMOTE_DIR/$file" || true
      exit 1
    }
  fi
done < "$REMOTE_DIR/local-files.txt"

echo "Apps Script local source and manifest match remote."
