#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-campus}"
DB_NAME="${POSTGRES_DB:-campusapp}"

UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
DOCUMENTS_DIR="${DOCUMENTS_DIR:-/app/private_documents}"
REPORTS_DIR="${ANALYTICS_REPORTS_DIR:-/app/reports}"
CLEANUP_ENABLED="${CLEANUP_ENABLED:-true}"
CLEANUP_INTERVAL_SECONDS="${CLEANUP_INTERVAL_SECONDS:-86400}"
CLEANUP_MIN_AGE_HOURS="${CLEANUP_MIN_AGE_HOURS:-24}"
CLEANUP_INITIAL_DELAY_SECONDS="${CLEANUP_INITIAL_DELAY_SECONDS:-300}"

echo "==> Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}"
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done

echo "==> Ensuring writable data directories exist"
mkdir -p \
  "$UPLOADS_DIR/avatars" \
  "$UPLOADS_DIR/images" \
  "$UPLOADS_DIR/videos" \
  "$UPLOADS_DIR/thumbs" \
  "$DOCUMENTS_DIR/originals" \
  "$DOCUMENTS_DIR/previews" \
  "$REPORTS_DIR"

echo "==> Bootstrapping or migrating database schema"
python -m app.db_bootstrap

start_cleanup_scheduler() {
  if [[ "$CLEANUP_ENABLED" != "true" && "$CLEANUP_ENABLED" != "1" && "$CLEANUP_ENABLED" != "yes" ]]; then
    echo "==> Scheduled cleanup disabled"
    return
  fi

  echo "==> Starting scheduled cleanup: every ${CLEANUP_INTERVAL_SECONDS}s, deleting orphans older than ${CLEANUP_MIN_AGE_HOURS}h"
  (
    sleep "$CLEANUP_INITIAL_DELAY_SECONDS"
    while true; do
      echo "==> Running scheduled cleanup"
      if python -m app.cleanup_cli --confirm --min-age-hours "$CLEANUP_MIN_AGE_HOURS" --json; then
        echo "==> Scheduled cleanup finished"
      else
        echo "==> Scheduled cleanup failed"
      fi
      sleep "$CLEANUP_INTERVAL_SECONDS"
    done
  ) &
}

start_cleanup_scheduler

echo "==> Starting backend (gunicorn + uvicorn workers)"
exec gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers "${GUNICORN_WORKERS:-4}" \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --max-requests 2000 \
  --max-requests-jitter 200 \
  --access-logfile - \
  --error-logfile -
