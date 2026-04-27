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

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.tuna.yml)
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
  local required="${3:-true}"
  local elapsed=0

  fail_wait() {
    local message="$1"
    compose logs --tail=80 "$service" || true
    if [[ "$required" == "true" ]]; then
      die "$message"
    fi
    warn "$message"
    return 1
  }

  while [[ "$elapsed" -lt "$timeout" ]]; do
    local status health
    status="$(container_status "$service" || true)"
    health="$(container_health "$service" || true)"

    echo "   -> waiting for ${service}: status=${status:-unknown}, health=${health:-unknown} (${elapsed}/${timeout}s)"

    if [[ "$status" == "running" && ( "$health" == "healthy" || "$health" == "none" ) ]]; then
      return 0
    fi

    if [[ "$health" == "unhealthy" || "$status" == "restarting" || "$status" == "exited" || "$status" == "dead" ]]; then
      fail_wait "Service '$service' failed to become healthy"
      return 1
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  fail_wait "Timed out waiting for service '$service'"
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
  die "Git working tree is dirty. Commit/stash changes before running deploy-tuna.sh"
fi

if [[ "$SKIP_PULL" == "true" ]]; then
  echo "==> Skipping git pull (--skip-pull)"
else
  echo "==> Pulling latest code from origin/${DEPLOY_BRANCH}"
  git fetch --all --prune
  git pull --ff-only origin "$DEPLOY_BRANCH"
fi

echo "==> Building and starting Tuna beta stack"
compose up -d --build --remove-orphans

echo "==> Recreating frontend to refresh bind-mounted nginx.tuna.conf"
compose up -d --force-recreate --no-deps frontend

echo "==> Waiting for services to stabilize"
wait_for_service postgres 60 true
wait_for_service redis 60 true
wait_for_service backend 120 true
wait_for_service frontend 120 true
echo "==> Verifying local loopback ingress"
curl --fail --silent --show-error http://127.0.0.1/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1/api/health >/dev/null

echo "==> Deployment status"
compose ps
compose logs --tail=50 backend frontend bot

echo "Tuna beta deployment completed successfully."
