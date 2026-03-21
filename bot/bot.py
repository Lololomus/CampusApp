import asyncio
import logging
import socket
import sys
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import (
    BOT_HEARTBEAT_FILE,
    BOT_HEARTBEAT_INTERVAL,
    BOT_FORCE_IPV4,
    BOT_TOKEN,
    FOLLOWUP_POLL_INTERVAL,
    LOG_LEVEL,
    NOTIFICATION_POLL_INTERVAL,
)
from handlers import callbacks, start
from services.api_client import api_client
from services.scheduler import poll_followups, poll_notifications

heartbeat_stop_event: asyncio.Event | None = None
heartbeat_task: asyncio.Task | None = None
_original_getaddrinfo = socket.getaddrinfo
_ipv4_patch_applied = False
TELEGRAM_API_HOST = "api.telegram.org"


def setup_logging():
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    logging.getLogger("aiogram").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)


def force_ipv4_for_telegram():
    global _ipv4_patch_applied

    if _ipv4_patch_applied:
        return

    def _telegram_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if host == TELEGRAM_API_HOST and family in (0, socket.AF_UNSPEC):
            family = socket.AF_INET
        return _original_getaddrinfo(host, port, family, type, proto, flags)

    socket.getaddrinfo = _telegram_ipv4_getaddrinfo
    _ipv4_patch_applied = True


async def heartbeat_loop(stop_event: asyncio.Event):
    heartbeat_path = Path(BOT_HEARTBEAT_FILE)
    heartbeat_path.parent.mkdir(parents=True, exist_ok=True)

    while not stop_event.is_set():
        heartbeat_path.write_text("ok\n", encoding="utf-8")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=BOT_HEARTBEAT_INTERVAL)
        except asyncio.TimeoutError:
            continue


async def on_startup(bot: Bot):
    global heartbeat_stop_event, heartbeat_task

    me = await bot.get_me()
    heartbeat_stop_event = asyncio.Event()
    heartbeat_task = asyncio.create_task(heartbeat_loop(heartbeat_stop_event))
    logging.info("Bot started: @%s (id: %s)", me.username, me.id)
    logging.info("Notification polling interval: %ss", NOTIFICATION_POLL_INTERVAL)
    logging.info("Follow-up polling interval: %ss", FOLLOWUP_POLL_INTERVAL)


async def on_shutdown(bot: Bot):
    global heartbeat_stop_event, heartbeat_task

    logging.info("Stopping bot...")
    if heartbeat_stop_event is not None:
        heartbeat_stop_event.set()
    if heartbeat_task is not None:
        await heartbeat_task
        heartbeat_task = None
    Path(BOT_HEARTBEAT_FILE).unlink(missing_ok=True)
    heartbeat_stop_event = None
    await api_client.close()
    logging.info("Bot stopped")


async def main():
    setup_logging()
    logger = logging.getLogger(__name__)

    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is not set in .env")
        sys.exit(1)

    if BOT_FORCE_IPV4:
        force_ipv4_for_telegram()
        logger.info("BOT_FORCE_IPV4 enabled: forcing IPv4 for %s", TELEGRAM_API_HOST)

    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher()
    dp.include_router(start.router)
    dp.include_router(callbacks.router)
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        poll_notifications,
        trigger="interval",
        seconds=NOTIFICATION_POLL_INTERVAL,
        args=[bot],
        id="poll_notifications",
        max_instances=1,
        replace_existing=True,
    )
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
    logger.info("Scheduler started")

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
        logging.info("Bot stopped manually")
