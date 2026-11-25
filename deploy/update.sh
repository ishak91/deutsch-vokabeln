#!/usr/bin/env bash
# Rebuild after you copy new code to the server. Keeps your progress.
set -euo pipefail
cd "$(dirname "$0")/.."
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
echo "Updated."
