#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm test
npm run typecheck
npx wrangler deploy "$@"
