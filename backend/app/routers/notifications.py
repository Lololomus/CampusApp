# ===== 📄 ФАЙЛ: backend/app/routers/notifications.py =====
# Роутер уведомлений:
# - GET/PATCH /notifications/settings — настройки юзера (фронтенд)
# - GET /notifications/queue — очередь для бота
# - POST /notifications/queue/{id}/sent|failed — подтверждение от бота
# - GET /notifications/followups/pending — follow-up'ы для бота
# - POST /notifications/followups/{id}/answer — ответ юзера через бота
# - POST /notifications/followups/{id}/sent — подтверждение отправки

import json
import os
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])

BOT_SECRET = os.getenv("BOT_SECRET", "bot-secret-key")


def _verify_bot(bot_secret: str = Query(...)):
    """Простая проверка авторизации бота"""
    if bot_secret != BOT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid bot secret")


# =============================================
# НАСТРОЙКИ УВЕДОМЛЕНИЙ (для фронтенда)
# =============================================

@router.get("/settings", response_model=schemas.NotificationSettingsResponse)
def get_notification_settings(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Получить настройки уведомлений текущего юзера"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(404, "User not found")

    settings = db.query(models.NotificationSettings).filter(
        models.NotificationSettings.user_id == user.id
    ).first()

    # Создаём дефолтные настройки если нет
    if not settings:
        settings = models.NotificationSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.patch("/settings", response_model=schemas.NotificationSettingsResponse)
def update_notification_settings(
    data: schemas.NotificationSettingsUpdate,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Обновить настройки уведомлений"""
    user = crud.get_user_by_telegram_id(db, telegram_id)
    if not user:
        raise HTTPException(404, "User not found")

    settings = db.query(models.NotificationSettings).filter(
        models.NotificationSettings.user_id == user.id
    ).first()

    if not settings:
        settings = models.NotificationSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Обновляем только переданные поля
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    logger.info(f"⚙️ Настройки уведомлений обновлены для user#{user.id}: {update_data}")
    return settings


# =============================================
# ОЧЕРЕДЬ УВЕДОМЛЕНИЙ (для бота)
# =============================================

# Маппинг тип уведомления → поле в настройках
NOTIF_TYPE_TO_SETTING = {
    'match': 'matches_enabled',
    'dating_like': 'dating_likes_enabled',
    'comment': 'comments_enabled',
    'comment_reply': 'comments_enabled',
    'market_contact': 'market_enabled',
    'request_response': 'requests_enabled',
    'milestone': 'milestones_enabled',
    'admin_report': None,  # всегда отправляем админам
}


@router.get("/queue")
def get_notification_queue(
    limit: int = Query(50, ge=1, le=100),
    bot_secret: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Забрать pending уведомления для отправки.
    Бот вызывает этот endpoint периодически.
    """
    _verify_bot(bot_secret)

    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.status == 'pending')
        .order_by(models.Notification.created_at.asc())
        .limit(limit)
        .all()
    )

    result = []

    for n in notifications:
        # Получаем получателя
        recipient = db.query(models.User).get(n.recipient_id)
        if not recipient:
            n.status = 'failed'
            n.error = 'Recipient not found'
            continue

        # Проверяем настройки юзера
        if _should_skip_notification(db, n.recipient_id, n.type):
            n.status = 'skipped'
            continue

        # Парсим payload
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

    db.commit()
    return result


@router.post("/queue/{notification_id}/sent")
def mark_notification_sent(
    notification_id: int,
    bot_secret: str = Query(...),
    db: Session = Depends(get_db),
):
    """Бот подтверждает успешную отправку"""
    _verify_bot(bot_secret)

    n = db.query(models.Notification).get(notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")

    n.status = 'sent'
    n.sent_at = datetime.now(timezone.utc)
    db.commit()

    return {"ok": True}


@router.post("/queue/{notification_id}/failed")
def mark_notification_failed(
    notification_id: int,
    error: str = Query("unknown"),
    bot_secret: str = Query(...),
    db: Session = Depends(get_db),
):
    """Бот сообщает об ошибке отправки"""
    _verify_bot(bot_secret)

    n = db.query(models.Notification).get(notification_id)
    if not n:
        raise HTTPException(404, "Notification not found")

    n.status = 'failed'
    n.error = error[:500]
    db.commit()

    return {"ok": True}


# =============================================
# FOLLOW-UPS (для бота)
# =============================================

@router.get("/followups/pending")
def get_pending_followups(
    bot_secret: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Забрать follow-up'ы, которые пора отправить (scheduled_at <= now).
    """
    _verify_bot(bot_secret)

    now = datetime.now(timezone.utc)

    followups = (
        db.query(models.Followup)
        .filter(
            models.Followup.status == 'pending',
            models.Followup.scheduled_at <= now,
        )
        .order_by(models.Followup.scheduled_at.asc())
        .limit(50)
        .all()
    )

    result = []

    for f in followups:
        # Получаем юзера
        user = db.query(models.User).get(f.user_id)
        if not user:
            f.status = 'expired'
            continue

        # Проверяем настройки
        setting_field = 'market_enabled' if f.target_type == 'market_item' else 'requests_enabled'
        if _should_skip_by_setting(db, f.user_id, setting_field):
            f.status = 'skipped'
            continue

        # Проверяем что target ещё существует и активен
        if not _is_target_active(db, f.target_type, f.target_id):
            f.status = 'expired'
            continue

        # Парсим payload
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

    db.commit()
    return result


@router.post("/followups/{followup_id}/sent")
def mark_followup_sent(
    followup_id: int,
    bot_secret: str = Query(...),
    db: Session = Depends(get_db),
):
    """Бот подтверждает отправку follow-up"""
    _verify_bot(bot_secret)

    f = db.query(models.Followup).get(followup_id)
    if not f:
        raise HTTPException(404, "Followup not found")

    f.status = 'sent'
    db.commit()

    return {"ok": True}


@router.post("/followups/{followup_id}/answer")
def answer_followup(
    followup_id: int,
    data: schemas.FollowupAnswer,
    bot_secret: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Бот передаёт ответ пользователя на follow-up кнопку.
    
    answer='yes': закрыть объявление/запрос автоматически
    answer='no': оставить активным, больше не спрашиваем
    answer='in_progress': повторный follow-up через 48ч (макс 2 попытки)
    """
    _verify_bot(bot_secret)

    f = db.query(models.Followup).get(followup_id)
    if not f:
        raise HTTPException(404, "Followup not found")

    now = datetime.now(timezone.utc)
    f.answered_at = now
    f.answer = data.answer

    if data.answer == 'yes':
        f.status = 'answered_yes'

        # Автоматическое действие: закрыть товар / запрос
        if f.target_type == 'market_item':
            item = db.query(models.MarketItem).get(f.target_id)
            if item and item.status == 'active':
                item.status = 'sold'
                logger.info(f"🏷️ Товар #{f.target_id} помечен как sold (follow-up)")

        elif f.target_type == 'request':
            req = db.query(models.Request).get(f.target_id)
            if req and req.status == 'active':
                req.status = 'closed'
                logger.info(f"📋 Запрос #{f.target_id} закрыт (follow-up)")

    elif data.answer == 'no':
        f.status = 'answered_no'
        # Оставляем активным, больше не спрашиваем

    elif data.answer == 'in_progress':
        if f.attempt < 2:
            # Создаём повторный follow-up через 48ч
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
            logger.info(f"🔄 Повторный follow-up #{f.target_type}#{f.target_id} через 48ч (попытка {f.attempt + 1})")
        else:
            # Максимум попыток, больше не спрашиваем
            f.status = 'answered_later'
            logger.info(f"🛑 Макс попыток follow-up для {f.target_type}#{f.target_id}")

    db.commit()

    return {"ok": True, "action": f.status}


# =============================================
# Приватные хелперы
# =============================================

def _should_skip_notification(db: Session, user_id: int, notif_type: str) -> bool:
    """Проверяет, нужно ли пропустить уведомление по настройкам юзера"""
    settings = db.query(models.NotificationSettings).filter(
        models.NotificationSettings.user_id == user_id
    ).first()

    if not settings:
        return False  # Нет настроек = дефолт = всё включено

    if settings.mute_all:
        return True

    setting_field = NOTIF_TYPE_TO_SETTING.get(notif_type)
    if setting_field is None:
        return False  # Тип без настройки (admin_report) — всегда отправляем

    return not getattr(settings, setting_field, True)


def _should_skip_by_setting(db: Session, user_id: int, setting_field: str) -> bool:
    """Проверяет конкретное поле настроек"""
    settings = db.query(models.NotificationSettings).filter(
        models.NotificationSettings.user_id == user_id
    ).first()

    if not settings:
        return False

    if settings.mute_all:
        return True

    return not getattr(settings, setting_field, True)


def _is_target_active(db: Session, target_type: str, target_id: int) -> bool:
    """Проверяет, что объект ещё существует и активен (не продан, не закрыт)"""
    if target_type == 'market_item':
        item = db.query(models.MarketItem).get(target_id)
        if not item or item.status != 'active' or item.is_deleted:
            return False
        return True

    elif target_type == 'request':
        req = db.query(models.Request).get(target_id)
        if not req or req.status != 'active' or req.is_deleted:
            return False
        return True

    return True
