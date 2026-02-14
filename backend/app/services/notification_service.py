# ===== 📄 ФАЙЛ: backend/app/services/notification_service.py =====
# Сервис уведомлений: вызывается из CRUD при событиях.
# Создаёт записи в таблицах notifications и followups.
# Бот потом забирает их и отправляет через Telegram Bot API.

import json
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger(__name__)


# =============================================
# Базовые функции создания записей
# =============================================

def create_notification(db: Session, recipient_id: int, notif_type: str, payload: dict):
    """
    Создать уведомление в очереди.
    НЕ коммитит — коммит делает вызывающий код вместе с основной операцией.
    """
    notif = models.Notification(
        recipient_id=recipient_id,
        type=notif_type,
        payload=json.dumps(payload, ensure_ascii=False),
    )
    db.add(notif)
    logger.info(f"📬 Уведомление создано: type={notif_type}, recipient={recipient_id}")


def create_followup(
    db: Session,
    user_id: int,
    followup_type: str,
    target_type: str,
    target_id: int,
    payload: dict,
    delay_hours: int = 24,
):
    """
    Создать отложенный follow-up.
    Проверяет дубликаты — не создаёт если уже есть pending на этот target.
    """
    existing = db.query(models.Followup).filter(
        models.Followup.user_id == user_id,
        models.Followup.target_type == target_type,
        models.Followup.target_id == target_id,
        models.Followup.status == 'pending',
    ).first()

    if existing:
        logger.debug(f"⏭️ Follow-up уже существует: {target_type}#{target_id} для user#{user_id}")
        return

    followup = models.Followup(
        user_id=user_id,
        type=followup_type,
        target_type=target_type,
        target_id=target_id,
        payload=json.dumps(payload, ensure_ascii=False),
        scheduled_at=datetime.now(timezone.utc) + timedelta(hours=delay_hours),
    )
    db.add(followup)
    logger.info(
        f"📋 Follow-up создан: type={followup_type}, "
        f"target={target_type}#{target_id}, через {delay_hours}ч"
    )


# =============================================
# Хелперы для конкретных событий
# =============================================

def notify_new_comment(db: Session, post, comment, commenter):
    """
    Новый комментарий к посту → уведомление автору поста.
    Не уведомляем: самого себя, анонимные посты.
    """
    if post.author_id == commenter.id:
        return
    if post.is_anonymous:
        return

    post_title = _truncate(post.title or post.body or "", 50)

    create_notification(db, post.author_id, 'comment', {
        'post_id': post.id,
        'post_title': post_title,
        'commenter_name': commenter.name,
        'comment_text': _truncate(comment.body, 100),
    })


def notify_comment_reply(db: Session, parent_comment, reply, replier):
    """
    Ответ на комментарий → уведомление автору родительского комментария.
    """
    if parent_comment.author_id == replier.id:
        return

    create_notification(db, parent_comment.author_id, 'comment_reply', {
        'post_id': parent_comment.post_id,
        'comment_text': _truncate(reply.body, 100),
        'replier_name': replier.name,
    })


def notify_match(db: Session, user_a, user_b):
    """
    Взаимный лайк → уведомление обоим юзерам о матче.
    """
    create_notification(db, user_a.id, 'match', {
        'matched_name': user_b.name,
        'matched_age': user_b.age,
        'matched_username': user_b.username,
    })
    create_notification(db, user_b.id, 'match', {
        'matched_name': user_a.name,
        'matched_age': user_a.age,
        'matched_username': user_a.username,
    })


def notify_dating_like(db: Session, liked_user_id: int):
    """
    Кто-то лайкнул в Dating → уведомление без раскрытия кто.
    """
    create_notification(db, liked_user_id, 'dating_like', {})


def notify_market_contact(db: Session, seller, buyer, item):
    """
    Покупатель написал по товару → уведомление продавцу + follow-up через 24ч.
    """
    create_notification(db, seller.id, 'market_contact', {
        'item_id': item.id,
        'item_title': item.title,
        'buyer_name': buyer.name,
        'buyer_username': buyer.username,
    })

    create_followup(
        db,
        user_id=seller.id,
        followup_type='market_sold',
        target_type='market_item',
        target_id=item.id,
        payload={'item_title': item.title},
        delay_hours=24,
    )


def notify_request_response(db: Session, request_obj, responder):
    """
    Отклик на запрос → уведомление автору запроса + follow-up через 24ч.
    Follow-up создаётся один раз на запрос (не на каждый отклик).
    """
    create_notification(db, request_obj.author_id, 'request_response', {
        'request_id': request_obj.id,
        'request_title': request_obj.title,
        'responder_name': responder.name,
        'responder_username': responder.username,
    })

    create_followup(
        db,
        user_id=request_obj.author_id,
        followup_type='request_resolved',
        target_type='request',
        target_id=request_obj.id,
        payload={'request_title': request_obj.title},
        delay_hours=24,
    )


def notify_milestone(db: Session, post, milestone: int):
    """
    Пост набрал N лайков → уведомление автору.
    Не уведомляем анонимные посты.
    """
    if post.is_anonymous:
        return

    post_title = _truncate(post.title or post.body or "", 50)

    create_notification(db, post.author_id, 'milestone', {
        'post_id': post.id,
        'post_title': post_title,
        'milestone': milestone,
    })


def check_milestone(db: Session, post):
    """
    Проверяет, достиг ли пост milestone после лайка.
    Вызывать после инкремента likes_count.
    """
    milestones = [10, 50, 100, 500, 1000]
    if post.likes_count in milestones:
        notify_milestone(db, post, post.likes_count)


def notify_admin_report(db: Session, report):
    """
    Новый репорт → уведомление модераторам этого вуза + суперадминам.
    """
    # Амбассадоры этого вуза
    moderators = db.query(models.User).filter(
        models.User.role == 'ambassador',
        models.User.university == report.university,
    ).all()

    # Суперадмины (видят всё)
    superadmins = db.query(models.User).filter(
        models.User.role == 'superadmin',
    ).all()

    # Дедупликация
    all_mods = {m.id: m for m in moderators + superadmins}

    # Не уведомляем автора репорта если он модератор
    all_mods.pop(report.reporter_id, None)

    for mod in all_mods.values():
        create_notification(db, mod.id, 'admin_report', {
            'report_id': report.id,
            'target_type': report.target_type,
            'reason': report.reason,
        })

    logger.info(f"📢 Уведомлено {len(all_mods)} модераторов о репорте #{report.id}")


# =============================================
# Утилиты
# =============================================

def _truncate(text: str, max_len: int) -> str:
    """Обрезаем текст с многоточием"""
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."
