#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL for the source database}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL for the isolated local database}"
if [[ "$SOURCE_DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo "Refusing to restore a backup into the source database." >&2
  exit 1
fi
if [[ "$RESTORE_DATABASE_URL" != *"@localhost:"* &&
      "$RESTORE_DATABASE_URL" != *"@127.0.0.1:"* ]]; then
  echo "The restore target must be a local, isolated PostgreSQL database." >&2
  exit 1
fi

restored_db="$(psql "$RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align \
  --command='SELECT current_database()')"
if [[ "$restored_db" != "prometheus_restore" ]]; then
  echo "Refusing restore: database must be named prometheus_restore." >&2
  exit 1
fi

backup_dir="${BACKUP_OUTPUT_DIR:-./.backup-drill-private}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_file="$backup_dir/prometheus-public-$(date -u +%Y%m%dT%H%M%SZ).dump"

# This covers the app-owned public schema. Supabase Auth users and Storage objects
# require their own recovery strategy and are NOT protected by this file.
pg_dump --dbname="$SOURCE_DATABASE_URL" --schema=public --format=custom \
  --no-owner --no-acl --file="$backup_file"
pg_restore --list "$backup_file" > /dev/null
if command -v shasum >/dev/null 2>&1; then
  (cd "$backup_dir" && shasum -a 256 "$(basename "$backup_file")" > "$(basename "$backup_file").sha256")
else
  (cd "$backup_dir" && sha256sum "$(basename "$backup_file")" > "$(basename "$backup_file").sha256")
fi
if command -v shasum >/dev/null 2>&1; then
  (cd "$backup_dir" && shasum -a 256 --check "$(basename "$backup_file").sha256")
else
  (cd "$backup_dir" && sha256sum --check "$(basename "$backup_file").sha256")
fi

# The target name, loopback address and distinct URL checks above intentionally
# protect live production from accidental restore commands.
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists \
  --no-owner --no-acl --exit-on-error "$backup_file"

psql "$RESTORE_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command="SELECT COUNT(*) AS applied_migrations FROM public._prisma_migrations WHERE finished_at IS NOT NULL;"
psql "$RESTORE_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 \
  --command="SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='projects') AS projects_restored;"

echo "App-schema backup and isolated restore completed. Store the private dump off-site and verify its retention policy."
