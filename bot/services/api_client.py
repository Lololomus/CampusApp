# ===== 📄 ФАЙЛ: bot/services/api_client.py =====
# HTTP-клиент для общения бота с FastAPI бэкендом.

import logging
import aiohttp
from typing import Optional
from config import API_BASE_URL, BOT_SECRET

logger = logging.getLogger(__name__)


class ApiClient:
    """
    Async HTTP клиент к бэкенду CampusApp.
    Бот использует его для получения очереди уведомлений,
    подтверждения отправки и обработки follow-up ответов.
    """

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Lazy-создание сессии (переиспользуем connection pool)"""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=10)
            self._session = aiohttp.ClientSession(
                base_url=API_BASE_URL,
                timeout=timeout,
            )
        return self._session

    async def close(self):
        """Закрыть сессию при остановке бота"""
        if self._session and not self._session.closed:
            await self._session.close()

    # =============================================
    # Очередь уведомлений
    # =============================================

    async def get_notification_queue(self, limit: int = 50) -> list:
        """
        Забрать pending уведомления из очереди.
        Возвращает список: [{id, telegram_id, type, payload}, ...]
        """
        try:
            session = await self._get_session()
            async with session.get(
                "/notifications/queue",
                params={"bot_secret": BOT_SECRET, "limit": limit}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    text = await resp.text()
                    logger.error(f"Ошибка получения очереди: {resp.status} {text}")
                    return []
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка get_notification_queue: {e}")
            return []

    async def mark_sent(self, notification_id: int) -> bool:
        """Подтвердить успешную отправку уведомления"""
        try:
            session = await self._get_session()
            async with session.post(
                f"/notifications/queue/{notification_id}/sent",
                params={"bot_secret": BOT_SECRET}
            ) as resp:
                return resp.status == 200
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка mark_sent({notification_id}): {e}")
            return False

    async def mark_failed(self, notification_id: int, error: str = "unknown") -> bool:
        """Сообщить об ошибке отправки"""
        try:
            session = await self._get_session()
            async with session.post(
                f"/notifications/queue/{notification_id}/failed",
                params={"bot_secret": BOT_SECRET, "error": error[:200]}
            ) as resp:
                return resp.status == 200
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка mark_failed({notification_id}): {e}")
            return False

    # =============================================
    # Follow-ups
    # =============================================

    async def get_pending_followups(self) -> list:
        """
        Забрать follow-up'ы, которые пора отправить.
        Возвращает: [{id, telegram_id, type, target_type, target_id, attempt, payload}, ...]
        """
        try:
            session = await self._get_session()
            async with session.get(
                "/notifications/followups/pending",
                params={"bot_secret": BOT_SECRET}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    text = await resp.text()
                    logger.error(f"Ошибка получения followups: {resp.status} {text}")
                    return []
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка get_pending_followups: {e}")
            return []

    async def answer_followup(self, followup_id: int, answer: str) -> dict:
        """
        Передать ответ пользователя на follow-up.
        answer: 'yes' | 'no' | 'in_progress'
        """
        try:
            session = await self._get_session()
            async with session.post(
                f"/notifications/followups/{followup_id}/answer",
                params={"bot_secret": BOT_SECRET},
                json={"answer": answer}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    text = await resp.text()
                    logger.error(f"Ошибка answer_followup({followup_id}): {resp.status} {text}")
                    return {"ok": False, "error": text}
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка answer_followup({followup_id}): {e}")
            return {"ok": False, "error": str(e)}

    async def mark_followup_sent(self, followup_id: int) -> bool:
        """Подтвердить отправку follow-up (меняем статус на sent)"""
        try:
            session = await self._get_session()
            async with session.post(
                f"/notifications/followups/{followup_id}/sent",
                params={"bot_secret": BOT_SECRET}
            ) as resp:
                return resp.status == 200
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка mark_followup_sent({followup_id}): {e}")
            return False


# Глобальный инстанс (singleton)
api_client = ApiClient()
