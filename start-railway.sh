#!/bin/sh
set -e

echo "Running database schema push..."
pnpm --filter @workspace/db push --force || echo "DB push failed, continuing..."

echo "Starting API server..."
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
