#!/bin/bash
set -e

echo "=== Installing dependencies ==="
npm install

echo "=== Generating Prisma client ==="
npm run db:generate

echo "=== Running DB migrations ==="
npm run db:migrate

echo "=== Building all apps ==="
npm run build

echo "=== Restarting services ==="
pm2 restart wazenly-api --update-env
pm2 restart wazenly-web --update-env
pm2 restart wazenly-workers --update-env || pm2 start "node packages/queue/dist/run-workers.js" --name wazenly-workers

pm2 save

echo "=== Deploy complete ==="
pm2 status
