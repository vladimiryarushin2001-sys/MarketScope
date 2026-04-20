#!/bin/bash
set -euo pipefail

bash service/ensure_csv.sh

exec bash service/worker_start.sh

