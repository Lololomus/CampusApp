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

require_file() {
  local path="$1"
  [[ -f "$path" ]] || die "Required file is missing: $path"
}

env_value() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || die "Missing key '${key}' in ${file}"

  local raw="${line#*=}"
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="${raw%\'}"
  raw="${raw#\'}"
  echo "$raw"
}

is_true() {
  local value
  value="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

is_placeholder() {
  local value
  value="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == *"change_me"* || "$value" == *"changeme"* || "$value" == *"your-"* || "$value" == *"your_"* || "$value" == "test_token" || "$value" == *"example-secret"* ]]
}

require_secret() {
  local name="$1"
  local value="$2"
  local min_len="$3"
  [[ -n "$value" ]] || die "${name} must not be empty"
  [[ ${#value} -ge ${min_len} ]] || die "${name} must be at least ${min_len} characters"
  is_placeholder "$value" && die "${name} must not use a placeholder value"
}

if ! command -v docker >/dev/null 2>&1; then
  die "docker is not installed"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin is not available"
fi

require_file ".env"
require_file "docker-compose.yml"
require_file "docker-compose.prod.yml"
require_file "nginx/nginx.conf"
require_file "redis.conf"

APP_ENV="$(env_value ".env" "APP_ENV")"
[[ "$APP_ENV" == "prod" || "$APP_ENV" == "production" ]] || die "APP_ENV must be prod or production"

POSTGRES_PASSWORD="$(env_value ".env" "POSTGRES_PASSWORD")"
REDIS_PASSWORD="$(env_value ".env" "REDIS_PASSWORD")"
SECRET_KEY="$(env_value ".env" "SECRET_KEY")"
BOT_TOKEN="$(env_value ".env" "BOT_TOKEN")"
BOT_SECRET="$(env_value ".env" "BOT_SECRET")"
ANALYTICS_SALT="$(env_value ".env" "ANALYTICS_SALT")"
CORS_ORIGINS="$(env_value ".env" "CORS_ORIGINS")"
COOKIE_SECURE="$(env_value ".env" "COOKIE_SECURE")"
DEV_AUTH_ENABLED="$(env_value ".env" "DEV_AUTH_ENABLED")"
SQL_ECHO="$(env_value ".env" "SQL_ECHO")"
MINIAPP_URL="$(env_value ".env" "MINIAPP_URL")"
API_BASE_URL="$(env_value ".env" "API_BASE_URL")"
WEBHOOK_HOST="$(grep -E '^WEBHOOK_HOST=' .env | tail -n 1 | cut -d= -f2- || true)"

require_secret "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD" 16
require_secret "REDIS_PASSWORD" "$REDIS_PASSWORD" 16
require_secret "SECRET_KEY" "$SECRET_KEY" 32
require_secret "BOT_SECRET" "$BOT_SECRET" 32
require_secret "ANALYTICS_SALT" "$ANALYTICS_SALT" 16

[[ ${#BOT_TOKEN} -ge 20 && "$BOT_TOKEN" == *:* ]] || die "BOT_TOKEN must look like a real Telegram bot token"
is_placeholder "$BOT_TOKEN" && die "BOT_TOKEN must not use a placeholder value"

is_true "$COOKIE_SECURE" || die "COOKIE_SECURE must be true"
is_true "$DEV_AUTH_ENABLED" && die "DEV_AUTH_ENABLED must be false"
is_true "$SQL_ECHO" && die "SQL_ECHO must be false"

[[ "$MINIAPP_URL" == https://* ]] || die "MINIAPP_URL must start with https://"
[[ "$API_BASE_URL" == "http://backend:8000" ]] || die "API_BASE_URL must be http://backend:8000"

[[ "$CORS_ORIGINS" == *https://* ]] || die "CORS_ORIGINS must contain https:// origins"
[[ "$CORS_ORIGINS" != *"http://"* ]] || die "CORS_ORIGINS must not contain http:// origins in production"
[[ "$CORS_ORIGINS" != *"localhost"* && "$CORS_ORIGINS" != *"127.0.0.1"* ]] || die "CORS_ORIGINS must not contain localhost in production"

if [[ -n "$WEBHOOK_HOST" ]]; then
  warn "WEBHOOK_HOST is set, but the production deployment keeps the bot on polling"
fi

SSL_DIR="${CAMPUSAPP_SSL_DIR:-/srv/campusapp/ssl}"
[[ -f "${SSL_DIR}/fullchain.pem" ]] || die "Missing TLS certificate: ${SSL_DIR}/fullchain.pem"
[[ -f "${SSL_DIR}/privkey.pem" ]] || die "Missing TLS private key: ${SSL_DIR}/privkey.pem"

docker compose -f docker-compose.yml -f docker-compose.prod.yml config >/dev/null

echo "Production env validation passed."
