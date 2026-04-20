#!/bin/bash
set -euo pipefail

bash service/ensure_csv.sh

exec uvicorn service.app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

