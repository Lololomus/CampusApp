#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

warn() {
  echo "WARN: $*" >&2
}

env_value() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1

  local raw="${line#*=}"
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="${raw%\'}"
  raw="${raw#\'}"
  echo "$raw"
}

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)

compose() {
  docker compose "${COMPOSE_FILES[@]}" "$@"
}

BACKUP_DIR="${CAMPUSAPP_BACKUP_DIR:-/srv/campusapp/backups}"
UPLOADS_DIR="${CAMPUSAPP_UPLOADS_DIR:-/srv/campusapp/uploads}"
REPORTS_DIR="${CAMPUSAPP_REPORTS_DIR:-/srv/campusapp/reports}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
TARGET_DIR="${BACKUP_DIR}/${TIMESTAMP}"
mkdir -p "$TARGET_DIR"

POSTGRES_USER="$(env_value ".env" "POSTGRES_USER" || echo "campus")"
POSTGRES_DB="$(env_value ".env" "POSTGRES_DB" || echo "campusapp")"

POSTGRES_CONTAINER_ID="$(compose ps -q postgres || true)"
if [[ -n "$POSTGRES_CONTAINER_ID" ]] && [[ "$(docker inspect -f '{{.State.Status}}' "$POSTGRES_CONTAINER_ID" 2>/dev/null)" == "running" ]]; then
  echo "==> Creating PostgreSQL dump"
  compose exec -T postgres pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges > "${TARGET_DIR}/postgres.sql"
else
  warn "Postgres container is not running; skipping database dump"
fi

if [[ -d "$UPLOADS_DIR" ]]; then
  echo "==> Archiving uploads"
  tar -C "$UPLOADS_DIR" -czf "${TARGET_DIR}/uploads.tar.gz" .
else
  warn "Uploads directory does not exist; skipping uploads archive (${UPLOADS_DIR})"
fi

if [[ -d "$REPORTS_DIR" ]]; then
  echo "==> Archiving reports"
  tar -C "$REPORTS_DIR" -czf "${TARGET_DIR}/reports.tar.gz" .
else
  warn "Reports directory does not exist; skipping reports archive (${REPORTS_DIR})"
fi

mapfile -t checksum_files < <(find "$TARGET_DIR" -maxdepth 1 -type f ! -name 'SHA256SUMS' -printf '%f\n' | sort)
if ((${#checksum_files[@]})); then
  (
    cd "$TARGET_DIR"
    sha256sum "${checksum_files[@]}" > SHA256SUMS
  )
else
  warn "No backup artifacts were produced in ${TARGET_DIR}"
fi

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  mapfile -t expired_backups < <(
    find "$BACKUP_DIR" \
      -mindepth 1 \
      -maxdepth 1 \
      -type d \
      -regextype posix-extended \
      -regex '.*/[0-9]{8}T[0-9]{6}Z' \
      -mtime +"$RETENTION_DAYS" | sort
  )

  if ((${#expired_backups[@]})); then
    echo "==> Removing backups older than ${RETENTION_DAYS} days"
    for expired_backup in "${expired_backups[@]}"; do
      rm -rf -- "$expired_backup"
      echo "   -> removed $(basename "$expired_backup")"
    done
  fi
else
  warn "BACKUP_RETENTION_DAYS must be an integer; skipping retention cleanup"
fi

echo "Backup completed: ${TARGET_DIR}"
