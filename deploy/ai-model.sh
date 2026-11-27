#!/usr/bin/env bash
# Switch the AI model from the terminal (the AI page in the app does the same).
# Deletes every model on disk FIRST, then downloads the new one, so only one model ever uses the disk.
#   bash deploy/ai-model.sh               -> shows what is installed
#   bash deploy/ai-model.sh gemma4:e4b    -> replaces it with gemma4:e4b
set -euo pipefail
cd "$(dirname "$0")/.."
FILES=(-f docker-compose.yml)
[ -f deploy/Caddyfile ] && FILES+=(-f docker-compose.prod.yml)   # on the server
SUDO=""; docker info >/dev/null 2>&1 || SUDO="sudo"
OLLAMA=($SUDO docker compose "${FILES[@]}" exec -T ollama ollama)

if [ $# -eq 0 ]; then "${OLLAMA[@]}" list; exit 0; fi
NEW="$1"
for m in $("${OLLAMA[@]}" list | awk 'NR>1 {print $1}'); do
  echo "Deleting $m"; "${OLLAMA[@]}" rm "$m"
done
echo "Downloading $NEW (this can take a while)"
"${OLLAMA[@]}" pull "$NEW"
"${OLLAMA[@]}" list
echo "Done. The app uses $NEW now."
