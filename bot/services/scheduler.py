# ===== 📄 ФАЙЛ: bot/services/scheduler.py =====
# Периодические задачи: опрос очереди уведомлений и follow-up'ов.
# Вызываются APScheduler'ом из bot.py.

import logging
from aiogram import Bot
from services.api_client import api_client
from services.sender import NotificationSender

logger = logging.getLogger(__name__)

# Флаг для предотвращения одновременного выполнения
_notifications_lock = False
_followups_lock = False


async def poll_notifications(bot: Bot):
    """
    Забирает pending уведомления из бэкенда и отправляет.
    Вызывается каждые NOTIFICATION_POLL_INTERVAL секунд.
    """
    global _notifications_lock

    if _notifications_lock:
        return
    _notifications_lock = True

    try:
        # Забираем очередь
        queue = await api_client.get_notification_queue(limit=50)

        if not queue:
            return

        logger.info(f"📬 Получено {len(queue)} уведомлений из очереди")

        # Отправляем
        sender = NotificationSender(bot)
        stats = await sender.process_queue(queue)

        if stats["total"] > 0:
            logger.info(
                f"📊 Результат: отправлено {stats['sent']}, "
                f"ошибок {stats['failed']}, всего {stats['total']}"
            )

    except Exception as e:
        logger.error(f"❌ Ошибка в poll_notifications: {e}")

    finally:
        _notifications_lock = False


async def poll_followups(bot: Bot):
    """
    Забирает pending follow-up'ы и отправляет.
    Вызывается каждые FOLLOWUP_POLL_INTERVAL секунд.
    """
    global _followups_lock

    if _followups_lock:
        return
    _followups_lock = True

    try:
        # Забираем follow-up'ы которые пора отправить
        followups = await api_client.get_pending_followups()

        if not followups:
            return

        logger.info(f"📋 Получено {len(followups)} follow-up'ов для отправки")

        # Отправляем
        sender = NotificationSender(bot)
        stats = await sender.process_followups(followups)

        if stats["total"] > 0:
            logger.info(
                f"📊 Follow-ups: отправлено {stats['sent']}, "
                f"ошибок {stats['failed']}, всего {stats['total']}"
            )

    except Exception as e:
        logger.error(f"❌ Ошибка в poll_followups: {e}")

    finally:
        _followups_lock = False
