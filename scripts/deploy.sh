#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# ./scripts/deploy.sh dev  -> Worker bm-automations-dev, D1 bm-automations-dev
# Any other argument refuses. This script does not publish bm-automations.
if [ "${1:-}" = "dev" ]; then
  shift
  if [ "$#" -ne 0 ]; then
    echo "Refusing extra arguments. Dev deploy does not accept Wrangler flags." >&2
    exit 1
  fi
  npm test
  npm run typecheck
  node scripts/check-dev-config.mjs
  node scripts/enforce-dev-off.mjs
  npx wrangler deploy --env dev
  node scripts/enforce-dev-off.mjs
  exit 0
fi
echo "Refusing to deploy. Run ./scripts/deploy.sh dev to publish bm-automations-dev only." >&2
exit 1
