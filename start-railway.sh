#!/bin/sh
set -e

echo "Running database schema push..."
yes n | pnpm --filter @workspace/db push --force || echo "DB push finished (some prompts auto-answered)"

echo "Starting API server..."
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
