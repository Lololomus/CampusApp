# ===== 📄 ФАЙЛ: backend/app/routers/notifications.py =====
#
# ✅ Фаза 3: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession
#    - legacy_query_api(Model).get(id) → await db.get(Model, id)
#    - joinedload → selectinload (не используется тут)
#    - все хелперы тоже async

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app import models, schemas, crud
from app.auth_service import require_user
from app.config import get_settings
from app.services.analytics_service import record_server_event
from app.services import notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _verify_bot(x_bot_secret: str = Header(..., alias="X-Bot-Secret")):
    """Проверка авторизации бота через заголовок (✅ Фаза 0.3)"""
    if x_bot_secret != get_settings().bot_secret:
        raise HTTPException(status_code=403, detail="Invalid bot secret")


# =============================================
# INBOX (для фронтенда)
# =============================================

@router.get("/inbox")
async def get_inbox(
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models.Notification)
        .where(
            models.Notification.recipient_id == user.id,
            models.Notification.status.in_(['sent', 'pending']),
        )
        .order_by(models.Notification.created_at.desc())
        .limit(50)
    )
    notifications = res.scalars().all()

    result = []
    for n in notifications:
        try:
            payload = json.loads(n.payload) if isinstance(n.payload, str) else n.payload
        except json.JSONDecodeError:
            payload = {}

        # Для review_request добавить is_review_done — чтобы фронт не показывал кнопку повторно
        if n.type == 'review_request':
            item_id = payload.get("item_id")
            if item_id:
                review_check = await db.execute(
                    select(models.MarketReview).where(
                        models.MarketReview.reviewer_id == user.id,
                        models.MarketReview.item_id == item_id,
                    )
                )
                payload["is_review_done"] = review_check.scalar_one_or_none() is not None

        result.append({
            "id": n.id,
            "type": n.type,
            "payload": payload,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return result


@router.get("/inbox/unread-count")
async def get_inbox_unread_count(
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(func.count()).where(
            models.Notification.recipient_id == user.id,
            models.Notification.is_read == False,  # noqa: E712
            models.Notification.status.in_(['sent', 'pending']),
        )
    )
    count = res.scalar() or 0
    return {"count": count}


@router.post("/inbox/read-all")
async def mark_inbox_read_all(
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    res = await db.execute(
        update(models.Notification)
        .where(
            models.Notification.recipient_id == user.id,
            models.Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True, read_at=now)
    )
    await db.commit()
    if (res.rowcount or 0) > 0:
        await record_server_event(
            db,
            user.id,
            "notification_open",
            entity_type="notification",
            entity_id=0,
            properties_json={"acted": True, "read_count": int(res.rowcount or 0)},
        )
    return {"updated": res.rowcount}


# =============================================
# НАСТРОЙКИ УВЕДОМЛЕНИЙ (для фронтенда)
# =============================================

@router.get("/settings", response_model=schemas.NotificationSettingsResponse)
async def get_notification_settings(
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.NotificationSettings).where(
            models.NotificationSettings.user_id == user.id
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = models.NotificationSettings(user_id=user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.patch("/settings", response_model=schemas.NotificationSettingsResponse)
async def update_notification_settings(
    data: schemas.NotificationSettingsUpdate,
    user: models.User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.NotificationSettings).where(
            models.NotificationSettings.user_id == user.id
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = models.NotificationSettings(user_id=user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.commit()
    await db.refresh(settings)

    logger.info(f"Настройки уведомлений обновлены для user#{user.id}: {update_data}")
    return settings


# =============================================
# ОЧЕРЕДЬ УВЕДОМЛЕНИЙ (для бота)
# =============================================

NOTIF_TYPE_TO_SETTING = {
    'match': 'matches_enabled',
    'dating_like': 'dating_likes_enabled',
    'comment': 'comments_enabled',
    'comment_reply': 'comments_enabled',
    'market_contact': 'market_enabled',
    'request_response': 'requests_enabled',
    'milestone': 'milestones_enabled',
    'admin_report': None,
}


@router.get("/queue")
async def get_notification_queue(
    limit: int = Query(50, ge=1, le=100),
    _=Depends(_verify_bot),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models.Notification)
        .where(models.Notification.status == 'pending')
        .order_by(models.Notification.created_at.asc())
        .limit(limit)
    )
    notifications = res.scalars().all()

    result = []
    for n in notifications:
        recipient = await db.get(models.User, n.recipient_id)
        if not recipient:
            n.status = 'failed'
            n.error = 'Recipient not found'
            continue

        if await _should_skip_notification(db, n.recipient_id, n.type):
            n.status = 'skipped'
            continue

        try:
            payload = json.loads(n.payload) if isinstance(n.payload, str) else n.payload
        except json.JSONDecodeError:
            payload = {}

        result.append({
            "id": n.id,
            "telegram_id": recipient.telegram_id,
            "type": n.type,
            "payload": payload,
        })

    await db.commit()
    return result


@router.post("/queue/{notification_id}/sent")
async def mark_notification_sent(
    notification_id: int,
    _=Depends(_verify_bot),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(models.Notification, notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")

    n.status = 'sent'
    n.sent_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.post("/queue/{notification_id}/failed")
async def mark_notification_failed(
    notification_id: int,
    error: str = Query("unknown"),
    _=Depends(_verify_bot),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(models.Notification, notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")

    n.status = 'failed'
    n.error = error[:500]
    await db.commit()
    return {"ok": True}


# =============================================
# FOLLOW-UPS (для бота)
# =============================================

@router.get("/followups/pending")
async def get_pending_followups(
    _=Depends(_verify_bot),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()

    res = await db.execute(
        select(models.Followup)
        .where(
            models.Followup.status == 'pending',
            models.Followup.scheduled_at <= now,
        )
        .order_by(models.Followup.scheduled_at.asc())
        .limit(50)
    )
    followups = res.scalars().all()

    result = []
    for f in followups:
        user = await db.get(models.User, f.user_id)
        if not user:
            f.status = 'expired'
            continue

        setting_field = 'market_enabled' if f.target_type == 'market_item' else 'requests_enabled'
        if await _should_skip_by_setting(db, f.user_id, setting_field):
            f.status = 'skipped'
            continue

        if f.type != 'review_request' and not await _is_target_active(db, f.target_type, f.target_id):
            f.status = 'expired'
            continue

        try:
            payload = json.loads(f.payload) if isinstance(f.payload, str) else f.payload
        except json.JSONDecodeError:
            payload = {}

        result.append({
            "id": f.id,
            "telegram_id": user.telegram_id,
            "type": f.type,
            "target_type": f.target_type,
            "target_id": f.target_id,
            "attempt": f.attempt,
            "payload": payload,
        })

    await db.commit()
    return result


@router.post("/followups/{followup_id}/sent")
async def mark_followup_sent(
    followup_id: int,
    _=Depends(_verify_bot),
    db: AsyncSession = Depends(get_db),
):
    f = await db.get(models.Followup, followup_id)
    if not f:
        raise HTTPException(404, "Followup not found")

    f.status = 'sent'
    await db.commit()
    return {"ok": True}


@router.post("/followups/{followup_id}/answer")
async def answer_followup(
    followup_id: int,
    data: schemas.FollowupAnswer,
    _=Depends(_verify_bot),
    db: AsyncSession = Depends(get_db),
):
    f = await db.get(models.Followup, followup_id)
    if not f:
        raise HTTPException(404, "Followup not found")

    now = datetime.utcnow()
    f.answered_at = now
    f.answer = data.answer

    if data.answer == 'yes':
        f.status = 'answered_yes'

        if f.target_type == 'market_item':
            item = await db.get(models.MarketItem, f.target_id)
            if item and item.status == 'active':
                item.status = 'sold'
                logger.info(f"Товар #{f.target_id} помечен как sold (follow-up)")

            # Отправить запрос отзыва покупателю
            try:
                payload_data = json.loads(f.payload) if isinstance(f.payload, str) else f.payload
                buyer_id = payload_data.get("buyer_id")
                if buyer_id and item:
                    buyer = await db.get(models.User, buyer_id)
                    seller = await db.get(models.User, item.seller_id)
                    if buyer and seller:
                        await notification_service.notify_review_request(db, buyer, seller, item)
            except Exception as exc:
                logger.warning("notify_review_request failed: %s", exc)

        elif f.target_type == 'request':
            req = await db.get(models.Request, f.target_id)
            if req and req.status == 'active':
                req.status = 'closed'
                logger.info(f"Запрос #{f.target_id} закрыт (follow-up)")

    elif data.answer == 'no':
        f.status = 'answered_no'

    elif data.answer == 'in_progress':
        if f.attempt < 2:
            new_followup = models.Followup(
                user_id=f.user_id,
                type=f.type,
                target_type=f.target_type,
                target_id=f.target_id,
                payload=f.payload,
                scheduled_at=now + timedelta(hours=48),
                attempt=f.attempt + 1,
            )
            db.add(new_followup)
            f.status = 'answered_later'
            logger.info(f"Повторный follow-up #{f.target_type}#{f.target_id} через 48ч (попытка {f.attempt + 1})")
        else:
            f.status = 'answered_later'
            logger.info(f"Макс попыток follow-up для {f.target_type}#{f.target_id}")

    await db.commit()
    return {"ok": True, "action": f.status}


# =============================================
# Приватные хелперы (async)
# =============================================

async def _should_skip_notification(db: AsyncSession, user_id: int, notif_type: str) -> bool:
    result = await db.execute(
        select(models.NotificationSettings).where(
            models.NotificationSettings.user_id == user_id
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        return False
    if settings.mute_all:
        return True

    setting_field = NOTIF_TYPE_TO_SETTING.get(notif_type)
    if setting_field is None:
        return False

    return not getattr(settings, setting_field, True)


async def _should_skip_by_setting(db: AsyncSession, user_id: int, setting_field: str) -> bool:
    result = await db.execute(
        select(models.NotificationSettings).where(
            models.NotificationSettings.user_id == user_id
        )
    )
    settings = result.scalar_one_or_none()

    if not settings:
        return False
    if settings.mute_all:
        return True

    return not getattr(settings, setting_field, True)


async def _is_target_active(db: AsyncSession, target_type: str, target_id: int) -> bool:
    if target_type == 'market_item':
        item = await db.get(models.MarketItem, target_id)
        if not item or item.status != 'active' or item.is_deleted:
            return False
        return True
    elif target_type == 'request':
        req = await db.get(models.Request, target_id)
        if not req or req.status != 'active' or req.is_deleted:
            return False
        return True
    return True
