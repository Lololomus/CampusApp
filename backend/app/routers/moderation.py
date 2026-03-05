# ===== 📄 ФАЙЛ: backend/app/routers/moderation.py =====
#
# ✅ Фаза 3: async/await, legacy_sync_db_dep → get_db, Session → AsyncSession
#    - legacy_query_api() → select() + await db.execute()
#    - joinedload → selectinload
#    - legacy_query_api(Model).get(id) → await db.get(Model, id)
#
# ⚠️ NOTE: Этот роутер всё ещё использует telegram_id=Query(...)
#    вместо require_user. Это будет исправлено отдельно (Фаза 0.2 follow-up).

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy import select, func, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app import models, schemas
from app.services import notification_service as notif

router = APIRouter(tags=["moderation"])


# ========================================
# ХЕЛПЕРЫ АВТОРИЗАЦИИ
# ========================================


async def get_user_or_404(db: AsyncSession, telegram_id: int) -> models.User:
    result = await db.execute(
        select(models.User).where(models.User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def require_moderator(user: models.User) -> models.User:
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(status_code=403, detail="Недостаточно прав. Требуется роль модератора.")
    return user


def require_superadmin(user: models.User) -> models.User:
    if user.role != 'superadmin':
        raise HTTPException(status_code=403, detail="Требуется роль суперадмина.")
    return user


def check_scope(moderator: models.User, target_university: str):
    if moderator.role == 'superadmin':
        return
    if moderator.university != target_university:
        raise HTTPException(
            status_code=403,
            detail=f"Вы можете модерировать только свой университет ({moderator.university})"
        )


async def check_target_not_moderator(db: AsyncSession, target_user_id: int):
    target_user = await db.get(models.User, target_user_id)
    if target_user and target_user.role in ('ambassador', 'superadmin'):
        raise HTTPException(
            status_code=403,
            detail="Нельзя модерировать контент другого модератора"
        )


async def log_action(
    db: AsyncSession,
    moderator_id: int,
    action: str,
    target_type: str,
    target_id: int,
    target_user_id: int = None,
    reason: str = None,
    university: str = None,
):
    log = models.ModerationLog(
        moderator_id=moderator_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_user_id=target_user_id,
        reason=reason,
        university=university,
    )
    db.add(log)
    await db.flush()
    return log


async def auto_expire_shadow_bans(db: AsyncSession):
    now = datetime.utcnow()
    result = await db.execute(
        select(models.User).where(
            or_(
                models.User.is_shadow_banned_posts == True,
                models.User.is_shadow_banned_comments == True,
            ),
            models.User.shadow_ban_expires_at.isnot(None),
            models.User.shadow_ban_expires_at <= now,
        )
    )
    expired = result.scalars().all()

    for user in expired:
        user.is_shadow_banned_posts = False
        user.is_shadow_banned_comments = False
        user.shadow_ban_expires_at = None
        user.shadow_ban_reason = None

    if expired:
        await db.commit()

    return len(expired)


# ========================================
# МОДЕРАЦИЯ КОНТЕНТА
# ========================================


@router.delete("/moderation/posts/{post_id}")
async def moderate_delete_post(
    post_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.Post).options(selectinload(models.Post.author)).where(models.Post.id == post_id)
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    if post.is_deleted:
        raise HTTPException(status_code=400, detail="Пост уже удалён")

    check_scope(moderator, post.author.university)
    await check_target_not_moderator(db, post.author_id)

    post.is_deleted = True
    post.deleted_by = moderator.id
    post.deleted_reason = action.reason
    post.deleted_at = datetime.utcnow()

    log = await log_action(
        db, moderator.id, 'delete_post', 'post', post.id,
        target_user_id=post.author_id,
        reason=action.reason,
        university=post.author.university,
    )

    await db.commit()
    return {"success": True, "moderation_log_id": log.id}


@router.delete("/moderation/comments/{comment_id}")
async def moderate_delete_comment(
    comment_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.Comment).options(selectinload(models.Comment.author)).where(models.Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="Комментарий уже удалён")

    check_scope(moderator, comment.author.university)
    await check_target_not_moderator(db, comment.author_id)

    comment.is_deleted = True
    comment.body = "Удалён модератором"
    comment.deleted_by = moderator.id
    comment.deleted_reason = action.reason

    post = await db.get(models.Post, comment.post_id)
    if post:
        post.comments_count = max(0, post.comments_count - 1)

    log = await log_action(
        db, moderator.id, 'delete_comment', 'comment', comment.id,
        target_user_id=comment.author_id,
        reason=action.reason,
        university=comment.author.university,
    )

    await db.commit()
    return {"success": True, "moderation_log_id": log.id}


@router.delete("/moderation/requests/{request_id}")
async def moderate_delete_request(
    request_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.Request).options(selectinload(models.Request.author)).where(models.Request.id == request_id)
    )
    request = result.scalar_one_or_none()

    if not request:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if request.is_deleted:
        raise HTTPException(status_code=400, detail="Запрос уже удалён")

    check_scope(moderator, request.author.university)
    await check_target_not_moderator(db, request.author_id)

    request.is_deleted = True
    request.deleted_by = moderator.id
    request.deleted_reason = action.reason
    request.deleted_at = datetime.utcnow()

    log = await log_action(
        db, moderator.id, 'delete_request', 'request', request.id,
        target_user_id=request.author_id,
        reason=action.reason,
        university=request.author.university,
    )

    await db.commit()
    return {"success": True, "moderation_log_id": log.id}


@router.delete("/moderation/market/{item_id}")
async def moderate_delete_market_item(
    item_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.MarketItem).options(selectinload(models.MarketItem.seller)).where(models.MarketItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    if item.is_deleted:
        raise HTTPException(status_code=400, detail="Товар уже удалён")

    check_scope(moderator, item.university)
    await check_target_not_moderator(db, item.seller_id)

    item.is_deleted = True
    item.deleted_by = moderator.id
    item.deleted_reason = action.reason
    item.deleted_at = datetime.utcnow()

    log = await log_action(
        db, moderator.id, 'delete_market_item', 'market_item', item.id,
        target_user_id=item.seller_id,
        reason=action.reason,
        university=item.university,
    )

    await db.commit()
    return {"success": True, "moderation_log_id": log.id}


# ========================================
# ЗАКРЕПЛЕНИЕ ПОСТОВ
# ========================================


@router.post("/moderation/posts/{post_id}/pin")
async def toggle_pin_post(
    post_id: int,
    telegram_id: int = Query(...),
    action: schemas.PinPostAction = Body(default=None),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.Post).options(selectinload(models.Post.author)).where(
            models.Post.id == post_id,
            models.Post.is_deleted == False,
        )
    )
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")

    check_scope(moderator, post.author.university)

    if post.is_important:
        post.is_important = False
        post.pinned_by = None
        post.pinned_at = None

        await log_action(
            db, moderator.id, 'unpin_post', 'post', post.id,
            target_user_id=post.author_id,
            reason=action.reason if action else None,
            university=post.author.university,
        )

        await db.commit()
        return {"success": True, "pinned": False}
    else:
        pinned_count = await db.scalar(
            select(func.count(models.Post.id))
            .join(models.User, models.Post.author_id == models.User.id)
            .where(
                models.Post.is_important == True,
                models.Post.is_deleted == False,
                models.User.university == post.author.university,
            )
        )

        if pinned_count >= 3:
            raise HTTPException(
                status_code=400,
                detail="Максимум 3 закреплённых поста на университет",
            )

        post.is_important = True
        post.pinned_by = moderator.id
        post.pinned_at = datetime.utcnow()

        await log_action(
            db, moderator.id, 'pin_post', 'post', post.id,
            target_user_id=post.author_id,
            reason=action.reason if action else None,
            university=post.author.university,
        )

        await db.commit()
        return {"success": True, "pinned": True}


# ========================================
# ТЕНЕВОЙ БАН
# ========================================


@router.post("/moderation/ban")
async def shadow_ban_user(
    data: schemas.ShadowBanCreate = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    target = await db.get(models.User, data.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    check_scope(moderator, target.university)
    await check_target_not_moderator(db, target.id)

    target.is_shadow_banned_posts = data.ban_posts
    target.is_shadow_banned_comments = data.ban_comments
    target.shadow_ban_reason = data.reason

    if data.duration_days:
        target.shadow_ban_expires_at = datetime.utcnow() + timedelta(days=data.duration_days)
    else:
        target.shadow_ban_expires_at = None

    await log_action(
        db, moderator.id, 'shadow_ban', 'user', target.id,
        target_user_id=target.id,
        reason=f"[posts={data.ban_posts}, comments={data.ban_comments}, days={data.duration_days}] {data.reason}",
        university=target.university,
    )

    await db.commit()
    return {
        "success": True,
        "ban": {
            "user_id": target.id,
            "posts": target.is_shadow_banned_posts,
            "comments": target.is_shadow_banned_comments,
            "expires_at": str(target.shadow_ban_expires_at) if target.shadow_ban_expires_at else "permanent",
        },
    }


@router.delete("/moderation/ban/{user_id}")
async def shadow_unban_user(
    user_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))

    target = await db.get(models.User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    check_scope(moderator, target.university)

    target.is_shadow_banned_posts = False
    target.is_shadow_banned_comments = False
    target.shadow_ban_expires_at = None
    target.shadow_ban_reason = None

    await log_action(
        db, moderator.id, 'shadow_unban', 'user', target.id,
        target_user_id=target.id,
        university=target.university,
    )

    await db.commit()
    return {"success": True}


# ========================================
# ЖАЛОБЫ (REPORTS)
# ========================================


@router.post("/reports")
async def create_report(
    data: schemas.ReportCreate = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    reporter = await get_user_or_404(db, telegram_id)

    existing_res = await db.execute(
        select(models.Report).where(
            models.Report.reporter_id == reporter.id,
            models.Report.target_type == data.target_type,
            models.Report.target_id == data.target_id,
            models.Report.status == 'pending',
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Вы уже отправили жалобу на этот объект")

    if data.target_type == 'user':
        target_user = await db.get(models.User, data.target_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if target_user.id == reporter.id:
            raise HTTPException(status_code=400, detail="Нельзя отправить жалобу на самого себя")
        content_university = target_user.university
    else:
        content_university = await _get_content_university(db, data.target_type, data.target_id)
        if content_university is None:
            raise HTTPException(status_code=404, detail="Контент не найден")

    report = models.Report(
        reporter_id=reporter.id,
        target_type=data.target_type,
        target_id=data.target_id,
        reason=data.reason,
        description=data.description,
        source_type=data.source_type,
        source_id=data.source_id,
        status='pending',
        university=content_university,
    )

    db.add(report)
    await notif.notify_admin_report(db, report)
    await db.commit()
    await db.refresh(report)

    return {"success": True, "report_id": report.id}


async def _get_content_university(db: AsyncSession, target_type: str, target_id: int) -> Optional[str]:
    if target_type == 'post':
        result = await db.execute(
            select(models.Post).options(selectinload(models.Post.author)).where(models.Post.id == target_id)
        )
        obj = result.scalar_one_or_none()
        return obj.author.university if obj and obj.author else None
    elif target_type == 'comment':
        result = await db.execute(
            select(models.Comment).options(selectinload(models.Comment.author)).where(models.Comment.id == target_id)
        )
        obj = result.scalar_one_or_none()
        return obj.author.university if obj and obj.author else None
    elif target_type == 'request':
        result = await db.execute(
            select(models.Request).options(selectinload(models.Request.author)).where(models.Request.id == target_id)
        )
        obj = result.scalar_one_or_none()
        return obj.author.university if obj and obj.author else None
    elif target_type == 'market_item':
        obj = await db.get(models.MarketItem, target_id)
        return obj.university if obj else None
    elif target_type == 'dating_profile':
        result = await db.execute(
            select(models.DatingProfile).options(selectinload(models.DatingProfile.user)).where(models.DatingProfile.id == target_id)
        )
        obj = result.scalar_one_or_none()
        return obj.user.university if obj and obj.user else None
    elif target_type == 'user':
        obj = await db.get(models.User, target_id)
        return obj.university if obj else None
    return None


@router.get("/reports")
async def get_reports(
    telegram_id: int = Query(...),
    status: str = Query('pending'),
    target_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))
    normalized_status = 'reviewed' if status == 'resolved' else status

    filters = []
    if normalized_status and normalized_status != 'all':
        filters.append(models.Report.status == normalized_status)
    if target_type:
        filters.append(models.Report.target_type == target_type)
    if moderator.role == 'ambassador':
        filters.append(models.Report.university == moderator.university)

    total = await db.scalar(
        select(func.count(models.Report.id)).where(*filters)
    )

    result = await db.execute(
        select(models.Report)
        .options(selectinload(models.Report.reporter))
        .where(*filters)
        .order_by(models.Report.created_at.desc())
        .offset(offset).limit(limit)
    )
    reports = result.scalars().all()

    items = []
    for r in reports:
        items.append({
            "id": r.id,
            "reporter_id": r.reporter_id,
            "reporter": schemas.UserShort.model_validate(r.reporter) if r.reporter else None,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "reason": r.reason,
            "description": r.description,
            "source_type": r.source_type,
            "source_id": r.source_id,
            "status": r.status,
            "university": r.university,
            "moderator_note": r.moderator_note,
            "created_at": r.created_at,
            "reviewed_at": r.reviewed_at,
        })

    return {"items": items, "total": total, "has_more": offset + limit < total}


@router.patch("/reports/{report_id}")
async def review_report(
    report_id: int,
    status: str = Query(..., pattern="^(reviewed|dismissed|resolved)$"),
    moderator_note: Optional[str] = Query(None),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    moderator = require_moderator(await get_user_or_404(db, telegram_id))
    normalized_status = 'reviewed' if status == 'resolved' else status

    report = await db.get(models.Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Жалоба не найдена")
    if report.status != 'pending':
        raise HTTPException(status_code=400, detail="Жалоба уже обработана")
    if moderator.role == 'ambassador' and report.university != moderator.university:
        raise HTTPException(status_code=403, detail="Нет доступа к жалобам другого вуза")

    report.status = normalized_status
    report.reviewed_by = moderator.id
    report.reviewed_at = datetime.utcnow()
    report.moderator_note = moderator_note

    action_name = 'resolve_report' if normalized_status == 'reviewed' else 'dismiss_report'
    await log_action(
        db, moderator.id, action_name, 'report', report.id,
        reason=moderator_note,
        university=report.university,
    )

    await db.commit()
    return {"success": True}


# ========================================
# ОБЖАЛОВАНИЯ (APPEALS)
# ========================================


@router.post("/appeals")
async def create_appeal(
    data: schemas.AppealCreate = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_404(db, telegram_id)

    mod_log = await db.get(models.ModerationLog, data.moderation_log_id)
    if not mod_log:
        raise HTTPException(status_code=404, detail="Действие модерации не найдено")
    if mod_log.target_user_id != user.id:
        raise HTTPException(status_code=403, detail="Вы можете обжаловать только действия над вашим контентом")

    existing_res = await db.execute(
        select(models.Appeal).where(
            models.Appeal.user_id == user.id,
            models.Appeal.moderation_log_id == data.moderation_log_id,
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Вы уже подали апелляцию на это действие")

    appeal = models.Appeal(
        user_id=user.id,
        moderation_log_id=data.moderation_log_id,
        message=data.message,
        status='pending',
    )
    db.add(appeal)
    await db.commit()
    await db.refresh(appeal)

    return {"success": True, "appeal_id": appeal.id}


@router.get("/appeals")
async def get_appeals(
    telegram_id: int = Query(...),
    status: str = Query('pending'),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    require_superadmin(await get_user_or_404(db, telegram_id))

    filters = []
    if status and status != 'all':
        filters.append(models.Appeal.status == status)

    total = await db.scalar(
        select(func.count(models.Appeal.id)).where(*filters)
    )

    result = await db.execute(
        select(models.Appeal)
        .options(
            selectinload(models.Appeal.user),
            selectinload(models.Appeal.moderation_log),
        )
        .where(*filters)
        .order_by(models.Appeal.created_at.desc())
        .offset(offset).limit(limit)
    )
    appeals = result.scalars().all()

    items = []
    for a in appeals:
        items.append({
            "id": a.id,
            "user_id": a.user_id,
            "user": schemas.UserShort.model_validate(a.user) if a.user else None,
            "moderation_log_id": a.moderation_log_id,
            "message": a.message,
            "status": a.status,
            "reviewer_note": a.reviewer_note,
            "created_at": a.created_at,
            "reviewed_at": a.reviewed_at,
        })

    return {"items": items, "total": total, "has_more": offset + limit < total}


@router.patch("/appeals/{appeal_id}")
async def review_appeal(
    appeal_id: int,
    status: str = Query(..., pattern="^(approved|rejected)$"),
    reviewer_note: Optional[str] = Query(None),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    admin = require_superadmin(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.Appeal)
        .options(selectinload(models.Appeal.moderation_log))
        .where(models.Appeal.id == appeal_id)
    )
    appeal = result.scalar_one_or_none()

    if not appeal:
        raise HTTPException(status_code=404, detail="Апелляция не найдена")
    if appeal.status != 'pending':
        raise HTTPException(status_code=400, detail="Апелляция уже рассмотрена")

    appeal.status = status
    appeal.reviewed_by = admin.id
    appeal.reviewed_at = datetime.utcnow()
    appeal.reviewer_note = reviewer_note

    if status == 'approved':
        await _rollback_moderation(db, appeal.moderation_log, admin.id)

    await log_action(
        db, admin.id,
        'approve_appeal' if status == 'approved' else 'reject_appeal',
        'appeal', appeal.id,
        target_user_id=appeal.user_id,
        reason=reviewer_note,
    )

    await db.commit()
    return {"success": True}


async def _rollback_moderation(db: AsyncSession, mod_log: models.ModerationLog, admin_id: int):
    if not mod_log:
        return

    if mod_log.action == 'delete_post':
        post = await db.get(models.Post, mod_log.target_id)
        if post:
            post.is_deleted = False
            post.deleted_by = None
            post.deleted_reason = None
            post.deleted_at = None
            await log_action(db, admin_id, 'restore_post', 'post', post.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'delete_comment':
        comment = await db.get(models.Comment, mod_log.target_id)
        if comment:
            comment.is_deleted = False
            comment.deleted_by = None
            comment.deleted_reason = None
            comment.body = "[Восстановлен модератором]"
            post = await db.get(models.Post, comment.post_id)
            if post:
                post.comments_count += 1
            await log_action(db, admin_id, 'restore_comment', 'comment', comment.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'delete_request':
        request = await db.get(models.Request, mod_log.target_id)
        if request:
            request.is_deleted = False
            request.deleted_by = None
            request.deleted_reason = None
            request.deleted_at = None
            await log_action(db, admin_id, 'restore_request', 'request', request.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'delete_market_item':
        item = await db.get(models.MarketItem, mod_log.target_id)
        if item:
            item.is_deleted = False
            item.deleted_by = None
            item.deleted_reason = None
            item.deleted_at = None
            await log_action(db, admin_id, 'restore_market_item', 'market_item', item.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'shadow_ban':
        target = await db.get(models.User, mod_log.target_id)
        if target:
            target.is_shadow_banned_posts = False
            target.is_shadow_banned_comments = False
            target.shadow_ban_expires_at = None
            target.shadow_ban_reason = None
            await log_action(db, admin_id, 'shadow_unban', 'user', target.id, target_user_id=target.id)


# ========================================
# АДМИНКА: АМБАССАДОРЫ
# ========================================


@router.get("/admin/ambassadors")
async def list_ambassadors(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    require_superadmin(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.User)
        .where(models.User.role == 'ambassador')
        .order_by(models.User.university, models.User.name)
    )
    ambassadors = result.scalars().all()

    items = []
    for amb in ambassadors:
        actions_count = await db.scalar(
            select(func.count(models.ModerationLog.id)).where(
                models.ModerationLog.moderator_id == amb.id
            )
        )
        items.append({
            "id": amb.id,
            "telegram_id": amb.telegram_id,
            "name": amb.name,
            "username": amb.username,
            "university": amb.university,
            "institute": amb.institute,
            "role": amb.role,
            "actions_count": actions_count,
            "assigned_at": amb.updated_at,
        })

    return {"ambassadors": items, "total": len(items)}


@router.post("/admin/ambassadors")
async def assign_ambassador(
    data: schemas.AssignAmbassadorRequest = Body(...),
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    admin = require_superadmin(await get_user_or_404(db, telegram_id))

    result = await db.execute(
        select(models.User).where(models.User.telegram_id == data.telegram_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail=f"Пользователь с telegram_id={data.telegram_id} не найден")

    if target.role == 'ambassador':
        raise HTTPException(status_code=400, detail="Пользователь уже амбассадор")
    if target.role == 'superadmin':
        raise HTTPException(status_code=400, detail="Нельзя понизить суперадмина до амбассадора")

    if data.university and data.university != target.university:
        raise HTTPException(
            status_code=400,
            detail=f"Университет пользователя ({target.university}) не совпадает с указанным ({data.university})",
        )

    target.role = 'ambassador'

    await log_action(
        db, admin.id, 'assign_ambassador', 'user', target.id,
        target_user_id=target.id,
        reason=f"Назначен амбассадором {target.university}",
        university=target.university,
    )

    await db.commit()
    return {
        "success": True,
        "ambassador": {
            "id": target.id,
            "name": target.name,
            "university": target.university,
            "telegram_id": target.telegram_id,
        },
    }


@router.delete("/admin/ambassadors/{user_id}")
async def remove_ambassador(
    user_id: int,
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    admin = require_superadmin(await get_user_or_404(db, telegram_id))

    target = await db.get(models.User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.role != 'ambassador':
        raise HTTPException(status_code=400, detail="Пользователь не является амбассадором")

    target.role = 'user'

    await log_action(
        db, admin.id, 'remove_ambassador', 'user', target.id,
        target_user_id=target.id,
        reason=f"Снят с роли амбассадора {target.university}",
        university=target.university,
    )

    await db.commit()
    return {"success": True}


# ========================================
# АДМИНКА: ЛОГИ
# ========================================


@router.get("/admin/logs")
async def get_moderation_logs(
    telegram_id: int = Query(...),
    moderator_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    user = require_moderator(await get_user_or_404(db, telegram_id))

    filters = []
    if user.role == 'ambassador':
        filters.append(models.ModerationLog.moderator_id == user.id)
    elif moderator_id:
        filters.append(models.ModerationLog.moderator_id == moderator_id)

    if action:
        filters.append(models.ModerationLog.action == action)
    if university:
        filters.append(models.ModerationLog.university == university)

    total = await db.scalar(
        select(func.count(models.ModerationLog.id)).where(*filters)
    )

    result = await db.execute(
        select(models.ModerationLog)
        .options(
            selectinload(models.ModerationLog.moderator),
            selectinload(models.ModerationLog.target_user),
        )
        .where(*filters)
        .order_by(models.ModerationLog.created_at.desc())
        .offset(offset).limit(limit)
    )
    logs = result.scalars().all()

    items = []
    for log in logs:
        items.append({
            "id": log.id,
            "moderator": schemas.UserShort.model_validate(log.moderator) if log.moderator else None,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "target_user": schemas.UserShort.model_validate(log.target_user) if log.target_user else None,
            "reason": log.reason,
            "university": log.university,
            "created_at": log.created_at,
        })

    return {"items": items, "total": total, "has_more": offset + limit < total}


# ========================================
# АДМИНКА: СТАТИСТИКА
# ========================================


@router.get("/admin/stats")
async def get_admin_stats(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    require_superadmin(await get_user_or_404(db, telegram_id))

    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = await db.scalar(select(func.count(models.User.id)))
    dau = await db.scalar(select(func.count(models.User.id)).where(models.User.last_active_at >= day_ago))
    wau = await db.scalar(select(func.count(models.User.id)).where(models.User.last_active_at >= week_ago))
    mau = await db.scalar(select(func.count(models.User.id)).where(models.User.last_active_at >= month_ago))

    total_posts = await db.scalar(select(func.count(models.Post.id)).where(models.Post.is_deleted == False))
    total_comments = await db.scalar(select(func.count(models.Comment.id)).where(models.Comment.is_deleted == False))
    total_requests = await db.scalar(select(func.count(models.Request.id)).where(models.Request.is_deleted == False))
    total_market = await db.scalar(select(func.count(models.MarketItem.id)).where(models.MarketItem.is_deleted == False))

    pending_reports = await db.scalar(select(func.count(models.Report.id)).where(models.Report.status == 'pending'))
    pending_appeals = await db.scalar(select(func.count(models.Appeal.id)).where(models.Appeal.status == 'pending'))
    ambassadors_count = await db.scalar(select(func.count(models.User.id)).where(models.User.role == 'ambassador'))
    actions_today = await db.scalar(
        select(func.count(models.ModerationLog.id)).where(models.ModerationLog.created_at >= day_ago)
    )

    top_unis_result = await db.execute(
        select(models.User.university, func.count(models.User.id).label('count'))
        .group_by(models.User.university)
        .order_by(desc('count'))
        .limit(10)
    )
    top_unis = top_unis_result.all()

    return {
        "total_users": total_users,
        "dau": dau,
        "wau": wau,
        "mau": mau,
        "total_posts": total_posts,
        "total_comments": total_comments,
        "total_requests": total_requests,
        "total_market_items": total_market,
        "total_reports_pending": pending_reports,
        "total_appeals_pending": pending_appeals,
        "ambassadors_count": ambassadors_count,
        "moderation_actions_today": actions_today,
        "top_universities": [
            {"university": uni, "users_count": cnt} for uni, cnt in top_unis
        ],
    }


# ========================================
# ИНФОРМАЦИЯ О РОЛИ (для фронта)
# ========================================


@router.get("/moderation/my-role")
async def get_my_moderation_role(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_or_404(db, telegram_id)

    await auto_expire_shadow_bans(db)

    result = {
        "role": user.role,
        "university": user.university,
        "can_moderate": user.role in ('ambassador', 'superadmin'),
        "can_admin": user.role == 'superadmin',
        "scope": "all" if user.role == 'superadmin' else user.university if user.role == 'ambassador' else None,
    }

    if user.role in ('ambassador', 'superadmin'):
        filters = [models.Report.status == 'pending']
        if user.role == 'ambassador':
            filters.append(models.Report.university == user.university)
        result["pending_reports"] = await db.scalar(
            select(func.count(models.Report.id)).where(*filters)
        )

    return result
