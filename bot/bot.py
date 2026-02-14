# ===== 📄 ФАЙЛ: bot/bot.py =====
# Entry point бота CampusApp.
# Запуск: cd bot && python bot.py

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import (
    BOT_TOKEN,
    NOTIFICATION_POLL_INTERVAL,
    FOLLOWUP_POLL_INTERVAL,
    LOG_LEVEL,
)
from handlers import start, callbacks
from services.scheduler import poll_notifications, poll_followups
from services.api_client import api_client


def setup_logging():
    """Настройка логирования"""
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )
    # Приглушаем шумные логгеры
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    logging.getLogger("aiogram").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)


async def on_startup(bot: Bot):
    """Действия при запуске бота"""
    me = await bot.get_me()
    logging.info(f"🤖 Бот запущен: @{me.username} (id: {me.id})")
    logging.info(f"📬 Polling уведомлений: каждые {NOTIFICATION_POLL_INTERVAL}с")
    logging.info(f"📋 Polling follow-ups: каждые {FOLLOWUP_POLL_INTERVAL}с")


async def on_shutdown(bot: Bot):
    """Действия при остановке бота"""
    logging.info("🛑 Остановка бота...")
    await api_client.close()
    logging.info("✅ Бот остановлен")


async def main():
    """Главная функция запуска"""
    setup_logging()
    logger = logging.getLogger(__name__)

    # Проверяем токен
    if not BOT_TOKEN:
        logger.error("❌ BOT_TOKEN не указан в .env!")
        sys.exit(1)

    # Создаём бота
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    # Создаём диспетчер
    dp = Dispatcher()

    # Регистрируем хэндлеры
    dp.include_router(start.router)
    dp.include_router(callbacks.router)

    # Lifecycle hooks
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Запускаем планировщик периодических задач
    scheduler = AsyncIOScheduler(timezone="UTC")

    # Опрос очереди уведомлений
    scheduler.add_job(
        poll_notifications,
        trigger="interval",
        seconds=NOTIFICATION_POLL_INTERVAL,
        args=[bot],
        id="poll_notifications",
        max_instances=1,  # не запускать параллельно
        replace_existing=True,
    )

    # Опрос follow-up'ов
    scheduler.add_job(
        poll_followups,
        trigger="interval",
        seconds=FOLLOWUP_POLL_INTERVAL,
        args=[bot],
        id="poll_followups",
        max_instances=1,
        replace_existing=True,
    )

    scheduler.start()
    logger.info("⏰ Планировщик запущен")

    # Запускаем long polling
    try:
        await dp.start_polling(
            bot,
            allowed_updates=[
                "message",
                "callback_query",
            ],
        )
    finally:
        scheduler.shutdown(wait=False)
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("👋 Бот остановлен вручную")
