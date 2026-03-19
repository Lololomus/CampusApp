import os
from functools import lru_cache
from pathlib import Path
from typing import List, Set

from dotenv import load_dotenv
from pydantic import BaseModel, Field

PROD_ENV_VALUES = {"prod", "production"}
TRUE_VALUES = {"1", "true", "yes", "on"}
PLACEHOLDER_MARKERS = (
    "change_me",
    "changeme",
    "your-",
    "your_",
    "example-secret",
    "unsafe-secret",
    "dev-bot-secret",
    "dev-analytics-salt",
)
PLACEHOLDER_VALUES = {
    "test_token",
    "unsafe-secret-key",
    "dev-bot-secret",
    "dev-analytics-salt",
}

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
REPO_ROOT = BACKEND_ROOT.parent
REPORTS_ROOT = REPO_ROOT if (REPO_ROOT / "docker-compose.yml").exists() else BACKEND_ROOT

load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in TRUE_VALUES


def _looks_like_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return True
    if normalized in PLACEHOLDER_VALUES:
        return True
    return any(marker in normalized for marker in PLACEHOLDER_MARKERS)


def _require_prod_secret(name: str, value: str | None, *, min_len: int) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise RuntimeError(f"{name} must be set when APP_ENV=prod")
    if len(normalized) < min_len:
        raise RuntimeError(f"{name} must be at least {min_len} characters when APP_ENV=prod")
    if _looks_like_placeholder(normalized):
        raise RuntimeError(f"{name} must not use a placeholder value in production")
    return normalized


def _require_prod_bot_token(value: str | None) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise RuntimeError("BOT_TOKEN must be set when APP_ENV=prod")
    if len(normalized) < 20 or ":" not in normalized:
        raise RuntimeError("BOT_TOKEN must look like a real Telegram bot token when APP_ENV=prod")
    if _looks_like_placeholder(normalized):
        raise RuntimeError("BOT_TOKEN must not use a placeholder value in production")
    return normalized


class Settings(BaseModel):
    app_env: str = Field(default="dev")
    database_url: str = Field(...)

    bot_token: str = Field(default="test_token")
    bot_secret: str = Field(default="")
    webhook_host: str = Field(default="")
    webhook_path: str = Field(default="")

    jwt_secret: str = Field(...)
    jwt_alg: str = Field(default="HS256")
    access_ttl_min: int = Field(default=15)
    refresh_ttl_days: int = Field(default=30)
    auth_max_skew_seconds: int = Field(default=300)
    auth_session_binding_enabled: bool = Field(default=False)

    cors_origins: List[str] = Field(default_factory=list)
    cookie_secure: bool = Field(default=False)
    cookie_samesite: str = Field(default="lax")

    dev_auth_enabled: bool = Field(default=False)
    dev_telegram_ids: Set[int] = Field(default_factory=set)
    sql_echo: bool = Field(default=True)

    redis_url: str = Field(default="redis://localhost:6379/0")

    analytics_salt: str = Field(default="dev-analytics-salt")
    analytics_reports_dir: str = Field(default="reports")
    analytics_nightly_enabled: bool = Field(default=True)
    analytics_nightly_hour_msk: int = Field(default=3)
    analytics_raw_retention_days: int = Field(default=180)
    analytics_agg_retention_days: int = Field(default=730)

    deal_flow_v2_enabled: bool = Field(default=False)
    market_expiry_worker_enabled: bool = Field(default=False)
    market_expiry_poll_seconds: int = Field(default=60)
    market_lead_ttl_hours: int = Field(default=168)
    market_deal_selected_ttl_hours: int = Field(default=24)
    market_service_in_progress_ttl_hours: int = Field(default=168)
    market_deal_provider_confirmed_ttl_hours: int = Field(default=72)
    market_review_strict_completed_at: bool = Field(default=False)

    @property
    def is_prod(self) -> bool:
        return self.app_env.lower() in PROD_ENV_VALUES


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "dev").lower()
    is_prod_env = app_env in PROD_ENV_VALUES

    cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    cors_list = [value.strip() for value in cors_raw.split(",") if value.strip()]

    dev_ids_raw = os.getenv("DEV_TELEGRAM_IDS", "")
    dev_ids_set = {int(value.strip()) for value in dev_ids_raw.split(",") if value.strip().isdigit()}

    secret_key = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET")
    if is_prod_env:
        secret_key = _require_prod_secret("SECRET_KEY/JWT_SECRET", secret_key, min_len=32)
    else:
        secret_key = secret_key or "unsafe-secret-key"

    bot_secret = os.getenv("BOT_SECRET")
    if is_prod_env:
        bot_secret = _require_prod_secret("BOT_SECRET", bot_secret, min_len=32)
    else:
        bot_secret = bot_secret or "dev-bot-secret"

    bot_token = os.getenv("BOT_TOKEN", "test_token")
    if is_prod_env:
        bot_token = _require_prod_bot_token(bot_token)

    analytics_salt = os.getenv("ANALYTICS_SALT")
    if is_prod_env:
        analytics_salt = _require_prod_secret("ANALYTICS_SALT", analytics_salt, min_len=16)
    else:
        analytics_salt = analytics_salt or "dev-analytics-salt"

    sql_echo_raw = os.getenv("SQL_ECHO")
    if sql_echo_raw is None:
        sql_echo = not is_prod_env
    else:
        sql_echo = _truthy(sql_echo_raw)
    if is_prod_env and sql_echo:
        raise RuntimeError("SQL_ECHO must be false when APP_ENV=prod")

    dev_auth_enabled = _truthy(os.getenv("DEV_AUTH_ENABLED", "false"))
    if is_prod_env and dev_auth_enabled:
        raise RuntimeError("DEV_AUTH_ENABLED must be false when APP_ENV is production")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        if is_prod_env:
            raise RuntimeError("DATABASE_URL must be set when APP_ENV=prod")
        database_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/campus_app_dev"

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        if is_prod_env:
            raise RuntimeError("REDIS_URL must be set when APP_ENV=prod")
        redis_url = "redis://localhost:6379/0"

    cookie_secure = _truthy(os.getenv("COOKIE_SECURE", "false"))
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax")
    if is_prod_env and not cookie_secure:
        raise RuntimeError("COOKIE_SECURE must be true when APP_ENV=prod")
    if is_prod_env and cookie_samesite not in {"strict", "lax"}:
        raise RuntimeError("COOKIE_SAMESITE must be 'strict' or 'lax' when APP_ENV=prod")

    if is_prod_env:
        if not cors_list:
            raise RuntimeError("CORS_ORIGINS must contain at least one origin when APP_ENV=prod")
        for origin in cors_list:
            normalized = origin.lower()
            if not normalized.startswith("https://"):
                raise RuntimeError("CORS_ORIGINS must use https:// origins when APP_ENV=prod")
            if "localhost" in normalized or "127.0.0.1" in normalized:
                raise RuntimeError("CORS_ORIGINS must not contain localhost origins when APP_ENV=prod")

    return Settings(
        app_env=app_env,
        database_url=database_url,
        bot_token=bot_token,
        bot_secret=bot_secret,
        webhook_host=os.getenv("WEBHOOK_HOST", ""),
        webhook_path=os.getenv("WEBHOOK_PATH", ""),
        jwt_secret=secret_key,
        jwt_alg=os.getenv("JWT_ALG", "HS256"),
        access_ttl_min=int(os.getenv("ACCESS_TTL_MIN", "15")),
        refresh_ttl_days=int(os.getenv("REFRESH_TTL_DAYS", "30")),
        auth_max_skew_seconds=int(os.getenv("AUTH_MAX_SKEW_SECONDS", "300")),
        auth_session_binding_enabled=_truthy(
            os.getenv("AUTH_SESSION_BINDING_ENABLED", "true" if is_prod_env else "false")
        ),
        cors_origins=cors_list,
        cookie_secure=cookie_secure,
        cookie_samesite=cookie_samesite,
        dev_auth_enabled=dev_auth_enabled,
        dev_telegram_ids=dev_ids_set,
        sql_echo=sql_echo,
        redis_url=redis_url,
        analytics_salt=analytics_salt,
        analytics_reports_dir=os.getenv("ANALYTICS_REPORTS_DIR", str(REPORTS_ROOT / "reports")),
        analytics_nightly_enabled=_truthy(os.getenv("ANALYTICS_NIGHTLY_ENABLED", "true")),
        analytics_nightly_hour_msk=max(0, min(23, int(os.getenv("ANALYTICS_NIGHTLY_HOUR_MSK", "3")))),
        analytics_raw_retention_days=max(1, int(os.getenv("ANALYTICS_RAW_RETENTION_DAYS", "180"))),
        analytics_agg_retention_days=max(1, int(os.getenv("ANALYTICS_AGG_RETENTION_DAYS", "730"))),
        deal_flow_v2_enabled=_truthy(os.getenv("DEAL_FLOW_V2_ENABLED", "false")),
        market_expiry_worker_enabled=_truthy(
            os.getenv("MARKET_EXPIRY_WORKER_ENABLED", "true" if is_prod_env else "false")
        ),
        market_expiry_poll_seconds=max(10, int(os.getenv("MARKET_EXPIRY_POLL_SECONDS", "60"))),
        market_lead_ttl_hours=max(1, int(os.getenv("MARKET_LEAD_TTL_HOURS", "168"))),
        market_deal_selected_ttl_hours=max(1, int(os.getenv("MARKET_DEAL_SELECTED_TTL_HOURS", "24"))),
        market_service_in_progress_ttl_hours=max(1, int(os.getenv("MARKET_SERVICE_IN_PROGRESS_TTL_HOURS", "168"))),
        market_deal_provider_confirmed_ttl_hours=max(1, int(os.getenv("MARKET_DEAL_PROVIDER_CONFIRMED_TTL_HOURS", "72"))),
        market_review_strict_completed_at=_truthy(
            os.getenv("MARKET_REVIEW_STRICT_COMPLETED_AT", "true" if is_prod_env else "false")
        ),
    )
