#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

warn() {
  echo "WARN: $*" >&2
}

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SKIP_PULL=false

for arg in "$@"; do
  case "$arg" in
    --skip-pull) SKIP_PULL=true ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

compose() {
  docker compose "${COMPOSE_FILES[@]}" "$@"
}

container_id() {
  compose ps -q "$1"
}

container_status() {
  local id
  id="$(container_id "$1")"
  [[ -n "$id" ]] || return 1
  docker inspect -f '{{.State.Status}}' "$id" 2>/dev/null
}

container_health() {
  local id
  id="$(container_id "$1")"
  [[ -n "$id" ]] || return 1
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id" 2>/dev/null
}

wait_for_service() {
  local service="$1"
  local timeout="$2"
  local require_health="$3"
  local elapsed=0

  while [[ "$elapsed" -lt "$timeout" ]]; do
    local status health
    status="$(container_status "$service" || true)"
    health="$(container_health "$service" || true)"

    if [[ "$require_health" == "true" ]]; then
      echo "   -> waiting for ${service}: status=${status:-unknown}, health=${health:-unknown} (${elapsed}/${timeout}s)"
    else
      echo "   -> waiting for ${service}: status=${status:-unknown} (${elapsed}/${timeout}s)"
    fi

    if [[ "$status" == "running" ]]; then
      if [[ "$require_health" == "true" ]]; then
        if [[ "$health" == "healthy" || "$health" == "none" ]]; then
          return 0
        fi
      else
        return 0
      fi
    fi

    if [[ "$require_health" == "true" && "$health" == "unhealthy" ]]; then
      compose logs --tail=80 "$service" || true
      die "Service '$service' failed healthcheck"
    fi

    if [[ "$status" == "restarting" || "$status" == "exited" || "$status" == "dead" ]]; then
      compose logs --tail=80 "$service" || true
      die "Service '$service' failed to stay running (status=${status}, health=${health:-unknown})"
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  compose logs --tail=80 "$service" || true
  die "Timed out waiting for service '$service'"
}

if ! command -v docker >/dev/null 2>&1; then
  die "docker is not installed"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin is not available"
fi

if ! command -v git >/dev/null 2>&1; then
  die "git is not installed"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  die "Git working tree is dirty. Commit/stash changes before running deploy-prod.sh"
fi

echo "==> Running production env checks"
./scripts/check-prod-env.sh

UPLOADS_DIR="${CAMPUSAPP_UPLOADS_DIR:-/srv/campusapp/uploads}"
REPORTS_DIR="${CAMPUSAPP_REPORTS_DIR:-/srv/campusapp/reports}"
BACKUP_DIR="${CAMPUSAPP_BACKUP_DIR:-/srv/campusapp/backups}"
ACME_DIR="${CAMPUSAPP_ACME_DIR:-/srv/campusapp/acme}"
SSL_DIR="${CAMPUSAPP_SSL_DIR:-/srv/campusapp/ssl}"

echo "==> Ensuring host directories exist"
for dir in "$UPLOADS_DIR" "$REPORTS_DIR" "$BACKUP_DIR" "$ACME_DIR" "$SSL_DIR"; do
  mkdir -p "$dir"
  [[ -w "$dir" ]] || die "Directory is not writable: $dir"
done

echo "==> Creating manual safety backup"
./scripts/backup-prod.sh

if [[ "$SKIP_PULL" == "true" ]]; then
  echo "==> Skipping git pull (--skip-pull)"
else
  echo "==> Pulling latest code from origin/${DEPLOY_BRANCH}"
  git fetch --all --prune
  git pull --ff-only origin "$DEPLOY_BRANCH"
fi

echo "==> Building and starting production containers"
compose up -d --build --remove-orphans

echo "==> Waiting for services to stabilize"
wait_for_service postgres 60 true
wait_for_service redis 60 true
wait_for_service backend 120 true
wait_for_service frontend 120 true
wait_for_service bot 120 true

echo "==> Deployment status"
compose ps
compose logs --tail=50 backend frontend bot

echo "Deployment completed successfully."
