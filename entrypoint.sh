#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy 2>/dev/null || echo "Migration skipped or failed"

echo "Seeding database..."
npx prisma db seed 2>/dev/null || echo "Seed skipped (already seeded or failed)"

echo "Starting Next.js..."
exec node server.js
