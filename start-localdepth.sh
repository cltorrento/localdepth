#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

printf '\n🚀 Levantando LocalDepth...\n'

docker compose up -d

printf '\n📦 Iniciando backend...\n'
# Ejecuta backend en una terminal separada; no bloquea este script
osascript -e 'tell application "Terminal" to do script "cd \"$PWD\" && npm run dev"' >/dev/null 2>&1 || true

printf '\n🌐 Iniciando frontend...\n'
osascript -e 'tell application "Terminal" to do script "cd \"$PWD/apps/frontend\" && npm run dev"' >/dev/null 2>&1 || true

printf '\n🛠️ Iniciando admin...\n'
osascript -e 'tell application "Terminal" to do script "cd \"$PWD/apps/admin\" && npm run dev"' >/dev/null 2>&1 || true

printf '\n✅ Comandos lanzados.\n'
printf '   Frontend: http://localhost:3000\n'
printf '   Admin: http://localhost:3001\n'
printf '   API: http://localhost:4000\n'
