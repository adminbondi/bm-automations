#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm test
npm run typecheck
# ./scripts/deploy.sh dev  -> Worker bm-automations-dev, D1 bm-automations-dev
# ./scripts/deploy.sh      -> Worker bm-automations, D1 bm-automations
if [ "${1:-}" = "dev" ]; then
  shift
  exec npx wrangler deploy --env dev "$@"
fi
exec npx wrangler deploy "$@"
