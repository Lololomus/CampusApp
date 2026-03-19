#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-campus}"
DB_NAME="${POSTGRES_DB:-campusapp}"

UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
REPORTS_DIR="${ANALYTICS_REPORTS_DIR:-/app/reports}"

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
  "$REPORTS_DIR"

echo "==> Running Alembic migrations"
alembic upgrade head

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
