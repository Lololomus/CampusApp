# ===== 📄 ФАЙЛ: bot/services/sender.py =====
# Отправщик уведомлений. Получает данные из очереди,
# форматирует и отправляет через Telegram Bot API.

import logging
from aiogram import Bot
from aiogram.exceptions import (
    TelegramForbiddenError,
    TelegramBadRequest,
    TelegramRetryAfter,
)
import asyncio

from templates.messages import format_notification, format_followup
from keyboards.inline import followup_market_kb, followup_request_kb, review_stars_kb
from services.api_client import api_client

logger = logging.getLogger(__name__)


class NotificationSender:
    """Отправляет уведомления и follow-up'ы пользователям"""

    def __init__(self, bot: Bot):
        self.bot = bot

    # =============================================
    # Обычные уведомления
    # =============================================

    async def send_notification(self, notif: dict) -> bool:
        """
        Отправить одно уведомление.
        notif: {id, telegram_id, type, payload}
        Возвращает True если успешно.
        """
        notif_id = notif["id"]
        telegram_id = notif["telegram_id"]
        notif_type = notif["type"]
        payload = notif.get("payload", {})

        try:
            # Форматируем сообщение
            msg_data = format_notification(notif_type, payload)
            text = msg_data["text"]
            reply_markup = msg_data.get("reply_markup")

            # Отправляем
            await self.bot.send_message(
                chat_id=telegram_id,
                text=text,
                reply_markup=reply_markup,
                disable_web_page_preview=True,
            )

            # Подтверждаем отправку
            await api_client.mark_sent(notif_id)
            logger.info(f"✅ Уведомление #{notif_id} ({notif_type}) → {telegram_id}")
            return True

        except TelegramForbiddenError:
            # Юзер заблокировал бота
            error = "User blocked the bot"
            await api_client.mark_failed(notif_id, error)
            logger.warning(f"🚫 Бот заблокирован юзером {telegram_id}")
            return False

        except TelegramRetryAfter as e:
            # Rate limit — ждём и пробуем снова
            logger.warning(f"⏳ Rate limit, ждём {e.retry_after}с")
            await asyncio.sleep(e.retry_after)
            return await self.send_notification(notif)

        except TelegramBadRequest as e:
            error = f"Bad request: {e.message}"
            await api_client.mark_failed(notif_id, error)
            logger.error(f"❌ Ошибка отправки #{notif_id}: {error}")
            return False

        except Exception as e:
            error = str(e)[:200]
            await api_client.mark_failed(notif_id, error)
            logger.error(f"❌ Неожиданная ошибка #{notif_id}: {error}")
            return False

    async def process_queue(self, notifications: list) -> dict:
        """
        Обработать пачку уведомлений из очереди.
        Возвращает статистику: {sent, failed, total}
        """
        sent = 0
        failed = 0

        for notif in notifications:
            success = await self.send_notification(notif)
            if success:
                sent += 1
            else:
                failed += 1

            # Небольшая пауза чтобы не упереться в rate limit
            await asyncio.sleep(0.05)

        return {"sent": sent, "failed": failed, "total": len(notifications)}

    # =============================================
    # Follow-ups
    # =============================================

    async def send_followup(self, followup: dict) -> bool:
        """
        Отправить follow-up сообщение с инлайн-кнопками.
        followup: {id, telegram_id, type, target_type, target_id, attempt, payload}
        """
        followup_id = followup["id"]
        telegram_id = followup["telegram_id"]
        followup_type = followup["type"]
        target_type = followup.get("target_type", "")
        payload = followup.get("payload", {})
        attempt = followup.get("attempt", 1)

        try:
            # Форматируем текст
            text = format_followup(followup_type, payload)

            # Добавляем номер попытки если это повторный
            if attempt > 1:
                text += "\n\n<i>(повторный запрос)</i>"

            # Выбираем клавиатуру по типу
            if followup_type == "review_request":
                item_id = payload.get("item_id")
                seller_id = payload.get("seller_id")
                kb = review_stars_kb(item_id, seller_id)
            elif target_type == "market_item":
                kb = followup_market_kb(followup_id)
            elif target_type == "request":
                kb = followup_request_kb(followup_id)
            else:
                kb = followup_market_kb(followup_id)

            # Отправляем
            await self.bot.send_message(
                chat_id=telegram_id,
                text=text,
                reply_markup=kb,
                disable_web_page_preview=True,
            )

            # Подтверждаем отправку
            await api_client.mark_followup_sent(followup_id)
            logger.info(f"✅ Follow-up #{followup_id} ({followup_type}) → {telegram_id}")
            return True

        except TelegramForbiddenError:
            logger.warning(f"🚫 Follow-up #{followup_id}: бот заблокирован юзером {telegram_id}")
            return False

        except TelegramRetryAfter as e:
            logger.warning(f"⏳ Rate limit для follow-up, ждём {e.retry_after}с")
            await asyncio.sleep(e.retry_after)
            return await self.send_followup(followup)

        except Exception as e:
            logger.error(f"❌ Ошибка follow-up #{followup_id}: {e}")
            return False

    async def process_followups(self, followups: list) -> dict:
        """Обработать пачку follow-up'ов"""
        sent = 0
        failed = 0

        for fu in followups:
            success = await self.send_followup(fu)
            if success:
                sent += 1
            else:
                failed += 1
            await asyncio.sleep(0.05)

        return {"sent": sent, "failed": failed, "total": len(followups)}
