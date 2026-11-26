#!/usr/bin/env bash
# Prove a backup can be restored (docs/deployment.md, step 2).
#
#   bash scripts/production/verify-backup.sh backups/portfolio-<timestamp>.dump
#
# Checks the file's checksum, restores it into a throwaway database ("restore_check") on the local
# Docker Compose PostgreSQL, prints the exact row count of every restored table, and drops the
# throwaway database again. Production is never contacted. Compare the counts with
# `python -m app.cli.production legacy-report` / the Supabase table editor.
set -euo pipefail

dump="${1:-}"
if [[ -z "$dump" || ! -f "$dump" ]]; then
  echo "Usage: bash scripts/production/verify-backup.sh backups/<file>.dump" >&2
  exit 1
fi
root="$(cd "$(dirname "$0")/../.." && pwd)"
dir="$(cd "$(dirname "$dump")" && pwd)"
name="$(basename "$dump")"

if [[ -f "$dir/$name.sha256" ]]; then
  ( cd "$dir" && sha256sum --check --quiet "$name.sha256" ) && echo "Checksum: OK"
fi

cd "$root"
docker compose up -d db >/dev/null
# A container that was just started accepts connections a few seconds later.
for _ in $(seq 1 30); do
  docker compose exec -T db pg_isready -U portfolio -q && break
  sleep 2
done
if ! docker compose exec -T db pg_isready -U portfolio -q; then
  echo "The local database did not become ready; is Docker running?" >&2
  exit 1
fi
psql() { docker compose exec -T db psql -U portfolio -v ON_ERROR_STOP=1 "$@"; }
psql -d postgres -qc "drop database if exists restore_check" -c "create database restore_check"
trap 'psql -d postgres -qc "drop database if exists restore_check" >/dev/null' EXIT

# Supabase-specific objects (roles, extensions, auth/storage schemas) may not exist locally;
# those errors are expected and listed, the application and legacy data must restore.
# The dump is streamed through stdin: no file copy and no host/container path translation.
if ! docker compose exec -T db pg_restore --no-owner --no-privileges -U portfolio \
     -d restore_check < "$dir/$name" 2> "$root/backups/restore_check.log"; then
  echo "pg_restore reported $(grep -c 'error' "$root/backups/restore_check.log" || true) error(s);" \
       "see backups/restore_check.log (Supabase-only objects are expected to fail)."
fi

echo "Restored row counts (schema.table: rows):"
psql -d restore_check -At -c "
  select format('%s.%s', table_schema, table_name)
  from information_schema.tables
  where table_schema in ('public', 'legacy') and table_type = 'BASE TABLE'
  order by 1" | while read -r table; do
  # </dev/null: the inner docker exec must not swallow the rest of the table list.
  printf '  %-40s %s\n' "$table" "$(psql -d restore_check -At -c "select count(*) from $table" </dev/null)"
done
echo "The throwaway database is dropped again; production was not contacted."
