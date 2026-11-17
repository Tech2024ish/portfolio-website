#!/usr/bin/env bash
# Back up the production database before any production migration (docs/deployment.md, step 2).
#
#   export PRODUCTION_DATABASE_URL='postgresql://...'   # Supabase: Session pooler URI (port 5432)
#   bash scripts/production/backup.sh
#
# Writes backups/portfolio-<UTC timestamp>.dump (pg_dump custom format: every schema the
# database user can read, including legacy tables, data and sequences) and a .sha256 next to it.
# Uses the postgres:17 Docker image, so no local PostgreSQL tools are needed. The connection
# string is passed through the environment and never printed. Supabase Storage files are not in
# the database: download them separately (docs/deployment.md).
set -euo pipefail

if [[ -z "${PRODUCTION_DATABASE_URL:-}" ]]; then
  echo "Set PRODUCTION_DATABASE_URL first (it is never printed)." >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$root/backups"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="portfolio-$stamp.dump"

echo "Dumping the production database to backups/$file ..."
MSYS_NO_PATHCONV=1 docker run --rm \
  -e PRODUCTION_DATABASE_URL \
  -v "$root/backups:/backups" \
  postgres:17 \
  sh -c 'pg_dump --format=custom --no-owner --no-privileges --file "/backups/$0" "$PRODUCTION_DATABASE_URL"' "$file"

( cd "$root/backups" && sha256sum "$file" > "$file.sha256" )
size="$(du -h "$root/backups/$file" | cut -f1)"
echo "Done: backups/$file ($size). Verify it now: bash scripts/production/verify-backup.sh backups/$file"
