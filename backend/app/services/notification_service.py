# Notification service used by CRUD and routers.
# Creates records in notifications/followups tables.

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models

logger = logging.getLogger(__name__)


async def create_notification(db: AsyncSession, recipient_id: int, notif_type: str, payload: dict):
    """Create a queued notification. Commit is handled by caller transaction."""
    notif = models.Notification(
        recipient_id=recipient_id,
        type=notif_type,
        payload=json.dumps(payload, ensure_ascii=False),
    )
    db.add(notif)
    logger.info("Notification created: type=%s, recipient=%s", notif_type, recipient_id)


async def create_followup(
    db: AsyncSession,
    user_id: int,
    followup_type: str,
    target_type: str,
    target_id: int,
    payload: dict,
    delay_hours: int = 24,
):
    """Create delayed follow-up if there is no pending duplicate for the same target."""
    existing_result = await db.execute(
        select(models.Followup).where(
            models.Followup.user_id == user_id,
            models.Followup.target_type == target_type,
            models.Followup.target_id == target_id,
            models.Followup.status == "pending",
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        logger.debug("Follow-up already exists: %s#%s for user#%s", target_type, target_id, user_id)
        return

    followup = models.Followup(
        user_id=user_id,
        type=followup_type,
        target_type=target_type,
        target_id=target_id,
        payload=json.dumps(payload, ensure_ascii=False),
        scheduled_at=datetime.utcnow() + timedelta(hours=delay_hours),
    )
    db.add(followup)
    logger.info(
        "Follow-up created: type=%s, target=%s#%s, in %sh",
        followup_type,
        target_type,
        target_id,
        delay_hours,
    )


async def notify_new_comment(db: AsyncSession, post, comment, commenter):
    if post.author_id == commenter.id or post.is_anonymous:
        return

    post_title = _truncate(post.title or post.body or "", 50)
    await create_notification(
        db,
        post.author_id,
        "comment",
        {
            "post_id": post.id,
            "post_title": post_title,
            "commenter_name": commenter.name,
            "comment_text": _truncate(comment.body, 100),
        },
    )


async def notify_comment_reply(db: AsyncSession, parent_comment, reply, replier):
    if parent_comment.author_id == replier.id:
        return

    await create_notification(
        db,
        parent_comment.author_id,
        "comment_reply",
        {
            "post_id": parent_comment.post_id,
            "comment_text": _truncate(reply.body, 100),
            "replier_name": replier.name,
        },
    )


async def notify_match(db: AsyncSession, user_a, user_b):
    await create_notification(
        db,
        user_a.id,
        "match",
        {
            "matched_name": user_b.name,
            "matched_age": user_b.age,
            "matched_username": user_b.username,
        },
    )
    await create_notification(
        db,
        user_b.id,
        "match",
        {
            "matched_name": user_a.name,
            "matched_age": user_a.age,
            "matched_username": user_a.username,
        },
    )


async def notify_dating_like(db: AsyncSession, liked_user_id: int):
    await create_notification(db, liked_user_id, "dating_like", {})


async def notify_market_contact(db: AsyncSession, seller, buyer, item):
    await create_notification(
        db,
        seller.id,
        "market_contact",
        {
            "item_id": item.id,
            "item_title": item.title,
            "buyer_name": buyer.name,
            "buyer_username": buyer.username,
        },
    )

    await create_followup(
        db,
        user_id=seller.id,
        followup_type="market_sold",
        target_type="market_item",
        target_id=item.id,
        payload={
            "item_title": item.title,
            "item_type": item.item_type,
            "buyer_id": buyer.id,
            "buyer_name": buyer.name,
        },
        delay_hours=24,
    )


async def notify_review_request(db: AsyncSession, buyer, seller, item):
    """Запрос отзыва покупателю после подтверждения продажи продавцом."""
    from sqlalchemy import select
    from app import models
    existing = await db.execute(
        select(models.MarketReview).where(
            models.MarketReview.reviewer_id == buyer.id,
            models.MarketReview.item_id == item.id,
        )
    )
    if existing.scalar_one_or_none():
        return  # отзыв уже есть

    review_payload = {
        "seller_id": seller.id,
        "seller_name": seller.name,
        "item_id": item.id,
        "item_title": item.title,
    }

    await create_followup(
        db,
        user_id=buyer.id,
        followup_type="review_request",
        target_type="market_item",
        target_id=item.id,
        payload=review_payload,
        delay_hours=0,
    )
    await create_notification(db, buyer.id, "review_request", review_payload)


async def notify_request_response(db: AsyncSession, request_obj, responder):
    await create_notification(
        db,
        request_obj.author_id,
        "request_response",
        {
            "request_id": request_obj.id,
            "request_title": request_obj.title,
            "responder_name": responder.name,
            "responder_username": responder.username,
        },
    )

    await create_followup(
        db,
        user_id=request_obj.author_id,
        followup_type="request_resolved",
        target_type="request",
        target_id=request_obj.id,
        payload={"request_title": request_obj.title},
        delay_hours=24,
    )


async def notify_milestone(db: AsyncSession, post, milestone: int):
    if post.is_anonymous:
        return

    post_title = _truncate(post.title or post.body or "", 50)
    await create_notification(
        db,
        post.author_id,
        "milestone",
        {
            "post_id": post.id,
            "post_title": post_title,
            "milestone": milestone,
        },
    )


async def check_milestone(db: AsyncSession, post):
    milestones = [10, 50, 100, 500, 1000]
    if post.likes_count in milestones:
        await notify_milestone(db, post, post.likes_count)


async def notify_admin_report(db: AsyncSession, report):
    moderators_result = await db.execute(
        select(models.User).where(
            models.User.role == "ambassador",
            models.User.university == report.university,
        )
    )
    moderators = moderators_result.scalars().all()

    superadmins_result = await db.execute(
        select(models.User).where(models.User.role == "superadmin")
    )
    superadmins = superadmins_result.scalars().all()

    all_mods = {m.id: m for m in moderators + superadmins}
    all_mods.pop(report.reporter_id, None)

    for mod in all_mods.values():
        await create_notification(
            db,
            mod.id,
            "admin_report",
            {
                "report_id": report.id,
                "target_type": report.target_type,
                "reason": report.reason,
            },
        )

    logger.info("Notified %s moderators about report #%s", len(all_mods), report.id)


def _truncate(text: str, max_len: int) -> str:
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
