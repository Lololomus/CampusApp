import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv

PROD_ENV_VALUES = {"prod", "production"}
PLACEHOLDER_MARKERS = ("change_me", "changeme", "your-", "your_", "example")

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR / ".env")


def _looks_like_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    return not normalized or any(marker in normalized for marker in PLACEHOLDER_MARKERS)


def _require_prod_value(name: str, value: str | None, *, min_len: int = 1) -> str:
    normalized = (value or "").strip()
    if not normalized:
        sys.exit(f"Error: {name} must be set when APP_ENV=prod")
    if len(normalized) < min_len:
        sys.exit(f"Error: {name} must be at least {min_len} characters when APP_ENV=prod")
    if _looks_like_placeholder(normalized):
        sys.exit(f"Error: {name} must not use a placeholder value in production")
    return normalized


APP_ENV = os.getenv("APP_ENV", "dev").lower()
IS_PROD = APP_ENV in PROD_ENV_VALUES

def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _first_env(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return None


def _mask_proxy_url(value: str | None) -> str | None:
    if not value:
        return None

    parts = urlsplit(value)
    if "@" not in parts.netloc:
        return value

    _, host_part = parts.netloc.rsplit("@", 1)
    masked_netloc = f"***:***@{host_part}"
    return urlunsplit((parts.scheme, masked_netloc, parts.path, parts.query, parts.fragment))


BOT_TOKEN = os.getenv("BOT_TOKEN")
if IS_PROD:
    BOT_TOKEN = _require_prod_value("BOT_TOKEN", BOT_TOKEN, min_len=20)
elif not BOT_TOKEN:
    sys.exit("Error: BOT_TOKEN is not set in .env")

WEBHOOK_HOST = os.getenv("WEBHOOK_HOST")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/webhook")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", 8001))
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}" if WEBHOOK_HOST else None

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
if IS_PROD and API_BASE_URL != "http://backend:8000":
    sys.exit("Error: API_BASE_URL must be http://backend:8000 when APP_ENV=prod")

BOT_SECRET = os.getenv("BOT_SECRET")
if IS_PROD:
    BOT_SECRET = _require_prod_value("BOT_SECRET", BOT_SECRET, min_len=32)
elif not BOT_SECRET:
    BOT_SECRET = "dev-bot-secret"

NOTIFICATION_POLL_INTERVAL = int(os.getenv("NOTIFICATION_POLL_INTERVAL", "20"))
FOLLOWUP_POLL_INTERVAL = int(os.getenv("FOLLOWUP_POLL_INTERVAL", "30"))

MINIAPP_URL = os.getenv("MINIAPP_URL", "https://t.me/MyCampusBot/app")
if IS_PROD and not MINIAPP_URL.startswith("https://"):
    sys.exit("Error: MINIAPP_URL must start with https:// when APP_ENV=prod")

SUPPORT_USERNAME = (os.getenv("SUPPORT_USERNAME") or "nikochan1").lstrip("@").strip()
WELCOME_PHOTO_PATH = Path(
    os.getenv("WELCOME_PHOTO_PATH", ROOT_DIR / "frontend" / "public" / "photo_campus_640x360.jpg")
)

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
BOT_FORCE_IPV4 = _env_bool("BOT_FORCE_IPV4", default=False)
TELEGRAM_PROXY_URL = _first_env("TELEGRAM_PROXY_URL", "HTTPS_PROXY", "https_proxy")
MASKED_TELEGRAM_PROXY_URL = _mask_proxy_url(TELEGRAM_PROXY_URL)

BOT_HEARTBEAT_FILE = os.getenv("BOT_HEARTBEAT_FILE", "/tmp/campusapp-bot-heartbeat")
BOT_HEARTBEAT_INTERVAL = int(os.getenv("BOT_HEARTBEAT_INTERVAL", "15"))
BOT_HEARTBEAT_TIMEOUT = int(os.getenv("BOT_HEARTBEAT_TIMEOUT", "60"))

if BOT_HEARTBEAT_INTERVAL <= 0:
    sys.exit("Error: BOT_HEARTBEAT_INTERVAL must be greater than 0")

if BOT_HEARTBEAT_TIMEOUT <= BOT_HEARTBEAT_INTERVAL:
    sys.exit("Error: BOT_HEARTBEAT_TIMEOUT must be greater than BOT_HEARTBEAT_INTERVAL")
