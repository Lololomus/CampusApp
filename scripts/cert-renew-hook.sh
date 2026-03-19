#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CAMPUSAPP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILES=(-f "${ROOT_DIR}/docker-compose.yml" -f "${ROOT_DIR}/docker-compose.prod.yml")
SSL_DIR="${CAMPUSAPP_SSL_DIR:-/srv/campusapp/ssl}"
CERT_OWNER_USER="${CAMPUSAPP_CERT_OWNER_USER:-deploy}"
CERT_OWNER_GROUP="${CAMPUSAPP_CERT_OWNER_GROUP:-deploy}"
FRONTEND_SERVICE="${CAMPUSAPP_FRONTEND_SERVICE:-frontend}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

warn() {
  echo "WARN: $*" >&2
}

compose() {
  docker compose "${COMPOSE_FILES[@]}" "$@"
}

[[ -n "${RENEWED_LINEAGE:-}" ]] || die "RENEWED_LINEAGE is required"
[[ -f "${RENEWED_LINEAGE}/fullchain.pem" ]] || die "Missing certificate file: ${RENEWED_LINEAGE}/fullchain.pem"
[[ -f "${RENEWED_LINEAGE}/privkey.pem" ]] || die "Missing private key file: ${RENEWED_LINEAGE}/privkey.pem"
[[ -f "${ROOT_DIR}/docker-compose.yml" ]] || die "Missing compose file: ${ROOT_DIR}/docker-compose.yml"
[[ -f "${ROOT_DIR}/docker-compose.prod.yml" ]] || die "Missing compose file: ${ROOT_DIR}/docker-compose.prod.yml"

if ! command -v docker >/dev/null 2>&1; then
  die "docker is not installed"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin is not available"
fi

mkdir -p "${SSL_DIR}"
cp "${RENEWED_LINEAGE}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
cp "${RENEWED_LINEAGE}/privkey.pem" "${SSL_DIR}/privkey.pem"
chown "${CERT_OWNER_USER}:${CERT_OWNER_GROUP}" "${SSL_DIR}/fullchain.pem" "${SSL_DIR}/privkey.pem"
chmod 644 "${SSL_DIR}/fullchain.pem"
chmod 600 "${SSL_DIR}/privkey.pem"

frontend_id="$(compose ps -q "${FRONTEND_SERVICE}" || true)"
if [[ -z "${frontend_id}" ]]; then
  warn "Frontend service '${FRONTEND_SERVICE}' is not created; certificates were updated on disk only"
  exit 0
fi

frontend_status="$(docker inspect -f '{{.State.Status}}' "${frontend_id}" 2>/dev/null || true)"
if [[ "${frontend_status}" != "running" ]]; then
  warn "Frontend service '${FRONTEND_SERVICE}' is not running (status=${frontend_status:-unknown}); certificates were updated on disk only"
  exit 0
fi

if compose exec -T "${FRONTEND_SERVICE}" nginx -s reload; then
  echo "Frontend nginx reloaded successfully"
  exit 0
fi

warn "Frontend nginx reload failed; attempting container restart"
if compose restart "${FRONTEND_SERVICE}"; then
  echo "Frontend container restarted successfully"
  exit 0
fi

die "Frontend reload and restart both failed after certificate refresh"
