#!/usr/bin/env bash
set -e

printf '\n🛑 Deteniendo LocalDepth...\n'

pkill -f "astro dev --port 3000 --host" || true
pkill -f "vite --port 3001 --host" || true
pkill -f "node --experimental-strip-types" || true

printf '\n✅ Todo detenido.\n'
