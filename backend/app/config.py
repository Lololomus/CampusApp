import os
from functools import lru_cache
from typing import List, Set
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

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
    webhook_host: str = Field(default="")
    webhook_path: str = Field(default="")
    
    # --- Auth & Security ---
    jwt_secret: str = Field(...) 
    jwt_alg: str = Field(default="HS256")
    access_ttl_min: int = Field(default=15)
    refresh_ttl_days: int = Field(default=30)
    auth_max_skew_seconds: int = Field(default=120)

    # --- Настройки фронтенда и CORS ---
    cors_origins: List[str] = Field(default_factory=list)
    cookie_secure: bool = Field(default=False)
    cookie_samesite: str = Field(default="lax")

    # --- DEV Tools ---
    dev_auth_enabled: bool = Field(default=False)
    dev_telegram_ids: Set[int] = Field(default_factory=set)

    @property
    def is_prod(self) -> bool:
        return self.app_env.lower() == "prod"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Парсим список доменов
    cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    cors_list = [v.strip() for v in cors_raw.split(",") if v.strip()]

    # Парсим ID разработчиков
    dev_ids_raw = os.getenv("DEV_TELEGRAM_IDS", "")
    dev_ids_set = {
        int(v.strip()) for v in dev_ids_raw.split(",") if v.strip().isdigit()
    }

    # Ищем секрет в разных местах
    secret_key = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or "unsafe-secret-key"

    return Settings(
        app_env=os.getenv("APP_ENV", "dev"),
        database_url=os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/campus_app_dev"),
        
        bot_token=os.getenv("BOT_TOKEN", "test_token"),
        webhook_host=os.getenv("WEBHOOK_HOST", ""),
        webhook_path=os.getenv("WEBHOOK_PATH", ""),

        jwt_secret=secret_key,
        jwt_alg=os.getenv("JWT_ALG", "HS256"),
        access_ttl_min=int(os.getenv("ACCESS_TTL_MIN", "15")),
        refresh_ttl_days=int(os.getenv("REFRESH_TTL_DAYS", "30")),
        auth_max_skew_seconds=int(os.getenv("AUTH_MAX_SKEW_SECONDS", "120")),
        
        cors_origins=cors_list,
        cookie_secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        cookie_samesite=os.getenv("COOKIE_SAMESITE", "lax"),
        
        dev_auth_enabled=os.getenv("DEV_AUTH_ENABLED", "false").lower() == "true",
        dev_telegram_ids=dev_ids_set,
    )