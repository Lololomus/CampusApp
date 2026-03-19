# ===== 📄 ФАЙЛ: bot/services/api_client.py =====
# HTTP-клиент для общения бота с FastAPI бэкендом.

import logging
import aiohttp
from typing import Optional
from config import API_BASE_URL, BOT_SECRET

logger = logging.getLogger(__name__)
BOT_HEADERS = {"X-Bot-Secret": BOT_SECRET}


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
                headers=BOT_HEADERS,
                params={"limit": limit}
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
                headers=BOT_HEADERS
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
                headers=BOT_HEADERS,
                params={"error": error[:200]}
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
                headers=BOT_HEADERS
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
                headers=BOT_HEADERS,
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
                headers=BOT_HEADERS
            ) as resp:
                return resp.status == 200
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка mark_followup_sent({followup_id}): {e}")
            return False

    # =============================================
    # Отзывы (reviews)
    # =============================================

    async def create_review(
        self,
        telegram_id: int,
        rating: int,
        deal_id: Optional[int] = None,
        item_id: Optional[int] = None,
        source: str = "bot",
        status: str = "pending_text",
    ) -> dict:
        """Создать отзыв покупателя через бот."""
        if not deal_id and not item_id:
            return {"error": "deal_id or item_id is required"}

        payload = {"rating": rating, "source": source}
        if deal_id:
            payload["deal_id"] = deal_id
        else:
            payload["item_id"] = item_id

        try:
            session = await self._get_session()
            async with session.post(
                "/market/reviews",
                headers=BOT_HEADERS,
                params={"telegram_id": telegram_id},
                json=payload,
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                if resp.status == 409:
                    return {"error": "already_exists"}
                text = await resp.text()
                logger.error(f"create_review error {resp.status}: {text}")
                return {"error": text}
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка create_review: {e}")
            return {"error": str(e)}

    async def get_pending_review(self, telegram_id: int) -> Optional[dict]:
        """Получить pending_text отзыв пользователя (для перехвата текста в боте)."""
        try:
            session = await self._get_session()
            async with session.get(
                "/market/reviews/pending",
                headers=BOT_HEADERS,
                params={"telegram_id": telegram_id},
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка get_pending_review: {e}")
            return None

    async def add_review_text(
        self,
        telegram_id: int,
        review_id: int,
        text: Optional[str],
    ) -> bool:
        """Добавить текст к отзыву и завершить его."""
        try:
            session = await self._get_session()
            async with session.patch(
                f"/market/reviews/{review_id}/text",
                headers=BOT_HEADERS,
                params={"telegram_id": telegram_id},
                json={"text": text},
            ) as resp:
                return resp.status == 200
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка add_review_text: {e}")
            return False

    async def skip_review_request(
        self,
        telegram_id: int,
        deal_id: Optional[int] = None,
        item_id: Optional[int] = None,
    ) -> bool:
        """Пропустить запрос отзыва (бот)."""
        if not deal_id and not item_id:
            return False

        params = {"telegram_id": telegram_id}
        if deal_id:
            params["deal_id"] = deal_id
        else:
            params["item_id"] = item_id

        try:
            session = await self._get_session()
            async with session.post(
                "/market/reviews/skip",
                headers=BOT_HEADERS,
                params=params,
            ) as resp:
                return resp.status == 200
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка skip_review_request: {e}")
            return False


# Глобальный инстанс (singleton)
api_client = ApiClient()
