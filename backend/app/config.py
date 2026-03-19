import os
from functools import lru_cache
from typing import List, Set
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

PROD_ENV_VALUES = {"prod", "production"}

# Получаем путь к папке, где лежит этот файл (backend/app)
current_dir = Path(__file__).resolve().parent
# Поднимаемся на 2 уровня вверх: app -> backend -> CampusApp
project_root = current_dir.parent.parent
# Собираем полный путь к .env
env_path = project_root / ".env"

# Загружаем .env
load_dotenv(dotenv_path=env_path)

class Settings(BaseModel):
    # --- Основные настройки ---
    app_env: str = Field(default="dev")
    
    # БД: Берем готовую строку
    database_url: str = Field(...) 

    # --- Telegram & Webhook ---
    bot_token: str = Field(default="test_token")
    bot_secret: str = Field(default="")
    webhook_host: str = Field(default="")
    webhook_path: str = Field(default="")
    
    # --- Auth & Security ---
    jwt_secret: str = Field(...) 
    jwt_alg: str = Field(default="HS256")
    access_ttl_min: int = Field(default=15)
    refresh_ttl_days: int = Field(default=30)
    auth_max_skew_seconds: int = Field(default=300)
    auth_session_binding_enabled: bool = Field(default=False)

    # --- Настройки фронтенда и CORS ---
    cors_origins: List[str] = Field(default_factory=list)
    cookie_secure: bool = Field(default=False)
    cookie_samesite: str = Field(default="lax")

    # --- DEV Tools ---
    dev_auth_enabled: bool = Field(default=False)
    dev_telegram_ids: Set[int] = Field(default_factory=set)
    sql_echo: bool = Field(default=True)

    # --- Redis ---
    redis_url: str = Field(default="redis://localhost:6379/0")

    # --- Analytics ---
    analytics_salt: str = Field(default="dev-analytics-salt")
    analytics_reports_dir: str = Field(default="reports")
    analytics_nightly_enabled: bool = Field(default=True)
    analytics_nightly_hour_msk: int = Field(default=3)
    analytics_raw_retention_days: int = Field(default=180)
    analytics_agg_retention_days: int = Field(default=730)

    # --- Market ---
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

    # Парсим список доменов
    cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    cors_list = [v.strip() for v in cors_raw.split(",") if v.strip()]

    # Парсим ID разработчиков
    dev_ids_raw = os.getenv("DEV_TELEGRAM_IDS", "")
    dev_ids_set = {
        int(v.strip()) for v in dev_ids_raw.split(",") if v.strip().isdigit()
    }

    # Ищем секрет в разных местах
    secret_key = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET")
    if not secret_key:
        if is_prod_env:
            raise RuntimeError("SECRET_KEY/JWT_SECRET must be set when APP_ENV=prod")
        secret_key = "unsafe-secret-key"

    bot_secret = os.getenv("BOT_SECRET")
    if not bot_secret:
        if is_prod_env:
            raise RuntimeError("BOT_SECRET must be set when APP_ENV=prod")
        bot_secret = "dev-bot-secret"

    bot_token = os.getenv("BOT_TOKEN", "test_token")
    if is_prod_env and (not bot_token or bot_token == "test_token"):
        raise RuntimeError("BOT_TOKEN must be set to a real token when APP_ENV=prod")

    analytics_salt = os.getenv("ANALYTICS_SALT")
    if not analytics_salt:
        if is_prod_env:
            raise RuntimeError("ANALYTICS_SALT must be set when APP_ENV=prod")
        analytics_salt = "dev-analytics-salt"

    sql_echo_raw = os.getenv("SQL_ECHO")
    if sql_echo_raw is None:
        sql_echo = not is_prod_env
    else:
        sql_echo = sql_echo_raw.strip().lower() in {"1", "true", "yes", "on"}

    dev_auth_enabled = os.getenv("DEV_AUTH_ENABLED", "false").lower() == "true"
    if is_prod_env and dev_auth_enabled:
        raise RuntimeError("DEV_AUTH_ENABLED must be false when APP_ENV is production")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        if is_prod_env:
            raise RuntimeError("DATABASE_URL must be set when APP_ENV=prod")
        database_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/campus_app_dev"

    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    cookie_samesite = os.getenv("COOKIE_SAMESITE", "lax")
    if is_prod_env and not cookie_secure:
        raise RuntimeError("COOKIE_SECURE must be true when APP_ENV=prod")
    if is_prod_env and cookie_samesite not in ("strict", "lax"):
        raise RuntimeError("COOKIE_SAMESITE must be 'strict' or 'lax' when APP_ENV=prod")

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
        auth_session_binding_enabled=os.getenv(
            "AUTH_SESSION_BINDING_ENABLED",
            "true" if is_prod_env else "false",
        ).lower() in {"1", "true", "yes", "on"},
        
        cors_origins=cors_list,
        cookie_secure=cookie_secure,
        cookie_samesite=cookie_samesite,
        
        dev_auth_enabled=dev_auth_enabled,
        dev_telegram_ids=dev_ids_set,
        sql_echo=sql_echo,
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        analytics_salt=analytics_salt,
        analytics_reports_dir=os.getenv("ANALYTICS_REPORTS_DIR", str(project_root / "reports")),
        analytics_nightly_enabled=os.getenv("ANALYTICS_NIGHTLY_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
        analytics_nightly_hour_msk=max(0, min(23, int(os.getenv("ANALYTICS_NIGHTLY_HOUR_MSK", "3")))),
        analytics_raw_retention_days=max(1, int(os.getenv("ANALYTICS_RAW_RETENTION_DAYS", "180"))),
        analytics_agg_retention_days=max(1, int(os.getenv("ANALYTICS_AGG_RETENTION_DAYS", "730"))),
        deal_flow_v2_enabled=os.getenv("DEAL_FLOW_V2_ENABLED", "false").lower() in {"1", "true", "yes", "on"},
        market_expiry_worker_enabled=os.getenv(
            "MARKET_EXPIRY_WORKER_ENABLED",
            "true" if is_prod_env else "false",
        ).lower() in {"1", "true", "yes", "on"},
        market_expiry_poll_seconds=max(10, int(os.getenv("MARKET_EXPIRY_POLL_SECONDS", "60"))),
        market_lead_ttl_hours=max(1, int(os.getenv("MARKET_LEAD_TTL_HOURS", "168"))),
        market_deal_selected_ttl_hours=max(1, int(os.getenv("MARKET_DEAL_SELECTED_TTL_HOURS", "24"))),
        market_service_in_progress_ttl_hours=max(1, int(os.getenv("MARKET_SERVICE_IN_PROGRESS_TTL_HOURS", "168"))),
        market_deal_provider_confirmed_ttl_hours=max(1, int(os.getenv("MARKET_DEAL_PROVIDER_CONFIRMED_TTL_HOURS", "72"))),
        market_review_strict_completed_at=os.getenv(
            "MARKET_REVIEW_STRICT_COMPLETED_AT",
            "true" if is_prod_env else "false",
        ).lower() in {"1", "true", "yes", "on"},
    )
