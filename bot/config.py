# ===== 📄 ФАЙЛ: bot/config.py =====
import os
import sys
from dotenv import load_dotenv

# 1. Надежный путь к .env (родительская директория от текущего файла)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

# --- Telegram Settings ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    sys.exit("Error: BOT_TOKEN is not set in .env")

# --- Webhook Settings ---
# Если WEBHOOK_HOST не задан, бот может попытаться работать через Polling (для локалки)
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST") 
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/webhook")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", 8001))

# Полный URL для регистрации вебхука в Telegram
# Пример: https://my-domain.com/webhook
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}" if WEBHOOK_HOST else None

# --- Backend & MiniApp ---
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
# Секрет для защиты эндпоинтов бота (чтобы никто левый не слал фейковые апдейты, если порт открыт)
BOT_SECRET = os.getenv("BOT_SECRET", "my-secret-internal-key")

MINIAPP_URL = os.getenv("MINIAPP_URL", "https://t.me/MyCampusBot/app")

# --- Logging ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")