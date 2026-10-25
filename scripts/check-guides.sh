#!/bin/sh
set -eu
node scripts/build-guide-pack.mjs
node scripts/audit-recurring-guides.mjs
node tests/guide-content-check.mjs
node tests/walkthrough-check.mjs
node tests/argent-dailies-check.mjs
node tests/recurring-progress-check.mjs
python3 tests/guide-engine-check.py
python3 tests/guide-ui-check.py
python3 tests/daily-session-check.py
node tests/session-shared-check.mjs
python3 tests/reliability-lua.py
node tests/reliability-shared-check.mjs
node tests/reliability-content-check.mjs
node tests/catalogue-content-check.mjs
python3 tests/guide-navigation-check.py
python3 tests/addon-check.py
python3 -m unittest discover -s companion -p 'test_*.py'
node node_modules/typescript/bin/tsc --noEmit
node --import ./scripts/sites-env.mjs tests/guide-profile-check.mjs
node --import ./scripts/sites-env.mjs tests/guide-reports-check.mjs
node --import ./scripts/sites-env.mjs tests/reliability-db-check.mjs
