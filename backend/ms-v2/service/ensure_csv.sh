#!/bin/bash
set -euo pipefail

# ms-v2 requires SOURCE_CSV file path to exist.
# In production (Render) we fetch it from SOURCE_CSV_URL on container start.

CSV_PATH="${SOURCE_CSV:-/app/final_blyat_v3.csv}"
CSV_URL="${SOURCE_CSV_URL:-}"

mkdir -p "$(dirname "$CSV_PATH")"

if [ -f "$CSV_PATH" ]; then
  echo "[ms-v2] CSV exists: $CSV_PATH"
  exit 0
fi

if [ -z "$CSV_URL" ]; then
  echo "[ms-v2] ERROR: CSV not found at $CSV_PATH and SOURCE_CSV_URL is not set."
  echo "[ms-v2] Provide SOURCE_CSV_URL (public or signed URL) to download final_blyat_v3.csv."
  exit 1
fi

echo "[ms-v2] Downloading CSV from SOURCE_CSV_URL..."
tmp="${CSV_PATH}.tmp"
curl -fsSL "$CSV_URL" -o "$tmp"
mv "$tmp" "$CSV_PATH"
echo "[ms-v2] CSV downloaded to $CSV_PATH"

# Optional: keep file permissions readable
chmod 0644 "$CSV_PATH" || true

