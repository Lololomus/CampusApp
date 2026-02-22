# ===== 📄 ФАЙЛ: backend/app/routers/moderation.py =====

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, desc
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from app.database import get_db_sync
from app import models, schemas
from app.services import notification_service as notif

router = APIRouter(tags=["moderation"])


# ========================================
# ХЕЛПЕРЫ АВТОРИЗАЦИИ
# ========================================


def get_user_or_404(db: Session, telegram_id: int) -> models.User:
    """Получить юзера или 404"""
    user = db.query(models.User).filter(models.User.telegram_id == telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def require_moderator(user: models.User) -> models.User:
    """Проверка что юзер — амбассадор или суперадмин"""
    if user.role not in ('ambassador', 'superadmin'):
        raise HTTPException(status_code=403, detail="Недостаточно прав. Требуется роль модератора.")
    return user


def require_superadmin(user: models.User) -> models.User:
    """Проверка что юзер — суперадмин"""
    if user.role != 'superadmin':
        raise HTTPException(status_code=403, detail="Требуется роль суперадмина.")
    return user


def check_scope(moderator: models.User, target_university: str):
    """
    Проверка скоупа амбассадора: может модерировать только свой вуз.
    Суперадмин — без ограничений.
    """
    if moderator.role == 'superadmin':
        return
    if moderator.university != target_university:
        raise HTTPException(
            status_code=403,
            detail=f"Вы можете модерировать только свой университет ({moderator.university})"
        )


def check_target_not_moderator(db: Session, target_user_id: int):
    """Нельзя банить/удалять контент другого модератора или суперадмина"""
    target_user = db.query(models.User).filter(models.User.id == target_user_id).first()
    if target_user and target_user.role in ('ambassador', 'superadmin'):
        raise HTTPException(
            status_code=403,
            detail="Нельзя модерировать контент другого модератора"
        )


def log_action(
    db: Session,
    moderator_id: int,
    action: str,
    target_type: str,
    target_id: int,
    target_user_id: int = None,
    reason: str = None,
    university: str = None
):
    """Запись действия в лог модерации"""
    log = models.ModerationLog(
        moderator_id=moderator_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_user_id=target_user_id,
        reason=reason,
        university=university
    )
    db.add(log)
    db.flush()
    return log


def auto_expire_shadow_bans(db: Session):
    """Автоснятие истёкших банов (вызывается при проверке)"""
    now = datetime.now(timezone.utc)
    expired = db.query(models.User).filter(
        or_(
            models.User.is_shadow_banned_posts == True,
            models.User.is_shadow_banned_comments == True
        ),
        models.User.shadow_ban_expires_at.isnot(None),
        models.User.shadow_ban_expires_at <= now
    ).all()

    for user in expired:
        user.is_shadow_banned_posts = False
        user.is_shadow_banned_comments = False
        user.shadow_ban_expires_at = None
        user.shadow_ban_reason = None

    if expired:
        db.commit()

    return len(expired)


# ========================================
# МОДЕРАЦИЯ КОНТЕНТА
# ========================================


@router.delete("/moderation/posts/{post_id}")
def moderate_delete_post(
    post_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Мягкое удаление поста (амбассадор своего вуза / суперадмин)"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    post = db.query(models.Post).options(
        joinedload(models.Post.author)
    ).filter(models.Post.id == post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    if post.is_deleted:
        raise HTTPException(status_code=400, detail="Пост уже удалён")

    check_scope(moderator, post.author.university)
    check_target_not_moderator(db, post.author_id)

    post.is_deleted = True
    post.deleted_by = moderator.id
    post.deleted_reason = action.reason
    post.deleted_at = datetime.now(timezone.utc)

    log = log_action(
        db, moderator.id, 'delete_post', 'post', post.id,
        target_user_id=post.author_id,
        reason=action.reason,
        university=post.author.university
    )

    db.commit()
    return {"success": True, "moderation_log_id": log.id}


@router.delete("/moderation/comments/{comment_id}")
def moderate_delete_comment(
    comment_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Мягкое удаление комментария"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    comment = db.query(models.Comment).options(
        joinedload(models.Comment.author)
    ).filter(models.Comment.id == comment_id).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="Комментарий уже удалён")

    check_scope(moderator, comment.author.university)
    check_target_not_moderator(db, comment.author_id)

    comment.is_deleted = True
    comment.body = "Удалён модератором"
    comment.deleted_by = moderator.id
    comment.deleted_reason = action.reason

    # Уменьшаем счётчик комментов у поста
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
    if post:
        post.comments_count = max(0, post.comments_count - 1)

    log = log_action(
        db, moderator.id, 'delete_comment', 'comment', comment.id,
        target_user_id=comment.author_id,
        reason=action.reason,
        university=comment.author.university
    )

    db.commit()
    return {"success": True, "moderation_log_id": log.id}


@router.delete("/moderation/requests/{request_id}")
def moderate_delete_request(
    request_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Мягкое удаление запроса"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    request = db.query(models.Request).options(
        joinedload(models.Request.author)
    ).filter(models.Request.id == request_id).first()

    if not request:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if request.is_deleted:
        raise HTTPException(status_code=400, detail="Запрос уже удалён")

    check_scope(moderator, request.author.university)
    check_target_not_moderator(db, request.author_id)

    request.is_deleted = True
    request.deleted_by = moderator.id
    request.deleted_reason = action.reason
    request.deleted_at = datetime.now(timezone.utc)

    log = log_action(
        db, moderator.id, 'delete_request', 'request', request.id,
        target_user_id=request.author_id,
        reason=action.reason,
        university=request.author.university
    )

    db.commit()
    return {"success": True, "moderation_log_id": log.id}


@router.delete("/moderation/market/{item_id}")
def moderate_delete_market_item(
    item_id: int,
    action: schemas.ModerationAction = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Мягкое удаление товара"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    item = db.query(models.MarketItem).options(
        joinedload(models.MarketItem.seller)
    ).filter(models.MarketItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    if item.is_deleted:
        raise HTTPException(status_code=400, detail="Товар уже удалён")

    check_scope(moderator, item.university)
    check_target_not_moderator(db, item.seller_id)

    item.is_deleted = True
    item.deleted_by = moderator.id
    item.deleted_reason = action.reason
    item.deleted_at = datetime.now(timezone.utc)

    log = log_action(
        db, moderator.id, 'delete_market_item', 'market_item', item.id,
        target_user_id=item.seller_id,
        reason=action.reason,
        university=item.university
    )

    db.commit()
    return {"success": True, "moderation_log_id": log.id}


# ========================================
# ЗАКРЕПЛЕНИЕ ПОСТОВ
# ========================================


@router.post("/moderation/posts/{post_id}/pin")
def toggle_pin_post(
    post_id: int,
    telegram_id: int = Query(...),
    action: schemas.PinPostAction = Body(default=None),
    db: Session = Depends(get_db_sync)
):
    """Закрепить/открепить пост (макс. 3 на вуз)"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    post = db.query(models.Post).options(
        joinedload(models.Post.author)
    ).filter(models.Post.id == post_id, models.Post.is_deleted == False).first()

    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")

    check_scope(moderator, post.author.university)

    if post.is_important:
        # Открепляем
        post.is_important = False
        post.pinned_by = None
        post.pinned_at = None

        log_action(
            db, moderator.id, 'unpin_post', 'post', post.id,
            target_user_id=post.author_id,
            reason=action.reason if action else None,
            university=post.author.university
        )

        db.commit()
        return {"success": True, "pinned": False}
    else:
        # Проверяем лимит (макс 3 закреплённых на вуз)
        pinned_count = db.query(func.count(models.Post.id)).join(
            models.User, models.Post.author_id == models.User.id
        ).filter(
            models.Post.is_important == True,
            models.Post.is_deleted == False,
            models.User.university == post.author.university
        ).scalar()

        if pinned_count >= 3:
            raise HTTPException(
                status_code=400,
                detail="Максимум 3 закреплённых поста на университет"
            )

        post.is_important = True
        post.pinned_by = moderator.id
        post.pinned_at = datetime.now(timezone.utc)

        log_action(
            db, moderator.id, 'pin_post', 'post', post.id,
            target_user_id=post.author_id,
            reason=action.reason if action else None,
            university=post.author.university
        )

        db.commit()
        return {"success": True, "pinned": True}


# ========================================
# ТЕНЕВОЙ БАН
# ========================================


@router.post("/moderation/ban")
def shadow_ban_user(
    data: schemas.ShadowBanCreate = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Теневой бан пользователя"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    target = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    check_scope(moderator, target.university)
    check_target_not_moderator(db, target.id)

    # Применяем бан
    target.is_shadow_banned_posts = data.ban_posts
    target.is_shadow_banned_comments = data.ban_comments
    target.shadow_ban_reason = data.reason

    if data.duration_days:
        target.shadow_ban_expires_at = datetime.now(timezone.utc) + timedelta(days=data.duration_days)
    else:
        target.shadow_ban_expires_at = None  # перманентный

    log_action(
        db, moderator.id, 'shadow_ban', 'user', target.id,
        target_user_id=target.id,
        reason=f"[posts={data.ban_posts}, comments={data.ban_comments}, days={data.duration_days}] {data.reason}",
        university=target.university
    )

    db.commit()
    return {
        "success": True,
        "ban": {
            "user_id": target.id,
            "posts": target.is_shadow_banned_posts,
            "comments": target.is_shadow_banned_comments,
            "expires_at": str(target.shadow_ban_expires_at) if target.shadow_ban_expires_at else "permanent"
        }
    }


@router.delete("/moderation/ban/{user_id}")
def shadow_unban_user(
    user_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Снять теневой бан"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    check_scope(moderator, target.university)

    target.is_shadow_banned_posts = False
    target.is_shadow_banned_comments = False
    target.shadow_ban_expires_at = None
    target.shadow_ban_reason = None

    log_action(
        db, moderator.id, 'shadow_unban', 'user', target.id,
        target_user_id=target.id,
        university=target.university
    )

    db.commit()
    return {"success": True}


# ========================================
# ЖАЛОБЫ (REPORTS)
# ========================================


@router.post("/reports")
def create_report(
    data: schemas.ReportCreate = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Создать жалобу на контент или пользователя (любой пользователь)"""
    reporter = get_user_or_404(db, telegram_id)

    # Проверка дубликата (один юзер — одна жалоба на один объект)
    existing = db.query(models.Report).filter(
        models.Report.reporter_id == reporter.id,
        models.Report.target_type == data.target_type,
        models.Report.target_id == data.target_id,
        models.Report.status == 'pending'
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Вы уже отправили жалобу на этот объект")

    if data.target_type == 'user':
        target_user = db.query(models.User).filter(models.User.id == data.target_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if target_user.id == reporter.id:
            raise HTTPException(status_code=400, detail="Нельзя отправить жалобу на самого себя")
        content_university = target_user.university
    else:
        # Определяем вуз автора контента (для скоупинга)
        content_university = _get_content_university(db, data.target_type, data.target_id)
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
        university=content_university
    )

    db.add(report)
    notif.notify_admin_report(db, report)
    db.commit()
    db.refresh(report)

    return {"success": True, "report_id": report.id}


def _get_content_university(db: Session, target_type: str, target_id: int) -> Optional[str]:
    """Определить университет автора контента"""
    if target_type == 'post':
        obj = db.query(models.Post).options(joinedload(models.Post.author)).filter(models.Post.id == target_id).first()
        return obj.author.university if obj and obj.author else None
    elif target_type == 'comment':
        obj = db.query(models.Comment).options(joinedload(models.Comment.author)).filter(models.Comment.id == target_id).first()
        return obj.author.university if obj and obj.author else None
    elif target_type == 'request':
        obj = db.query(models.Request).options(joinedload(models.Request.author)).filter(models.Request.id == target_id).first()
        return obj.author.university if obj and obj.author else None
    elif target_type == 'market_item':
        obj = db.query(models.MarketItem).filter(models.MarketItem.id == target_id).first()
        return obj.university if obj else None
    elif target_type == 'dating_profile':
        obj = db.query(models.DatingProfile).options(joinedload(models.DatingProfile.user)).filter(models.DatingProfile.id == target_id).first()
        return obj.user.university if obj and obj.user else None
    elif target_type == 'user':
        obj = db.query(models.User).filter(models.User.id == target_id).first()
        return obj.university if obj else None
    return None


@router.get("/reports")
def get_reports(
    telegram_id: int = Query(...),
    status: str = Query('pending'),
    target_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db_sync)
):
    """Список жалоб (амбассадор видит свой вуз, суперадмин — все)"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))
    normalized_status = 'reviewed' if status == 'resolved' else status

    query = db.query(models.Report).options(
        joinedload(models.Report.reporter)
    )

    # Фильтр по статусу
    if normalized_status and normalized_status != 'all':
        query = query.filter(models.Report.status == normalized_status)

    # Фильтр по типу контента
    if target_type:
        query = query.filter(models.Report.target_type == target_type)

    # Скоуп амбассадора
    if moderator.role == 'ambassador':
        query = query.filter(models.Report.university == moderator.university)

    total = query.count()
    reports = query.order_by(models.Report.created_at.desc()).offset(offset).limit(limit).all()

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
            "reviewed_at": r.reviewed_at
        })

    return {"items": items, "total": total, "has_more": offset + limit < total}


@router.patch("/reports/{report_id}")
def review_report(
    report_id: int,
    status: str = Query(..., pattern="^(reviewed|dismissed|resolved)$"),
    moderator_note: Optional[str] = Query(None),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Обработать жалобу"""
    moderator = require_moderator(get_user_or_404(db, telegram_id))
    # TODO(remove-resolved-alias): удалить alias после полной синхронизации клиентов.
    normalized_status = 'reviewed' if status == 'resolved' else status

    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Жалоба не найдена")

    if report.status != 'pending':
        raise HTTPException(status_code=400, detail="Жалоба уже обработана")

    # Скоуп
    if moderator.role == 'ambassador' and report.university != moderator.university:
        raise HTTPException(status_code=403, detail="Нет доступа к жалобам другого вуза")

    report.status = normalized_status
    report.reviewed_by = moderator.id
    report.reviewed_at = datetime.now(timezone.utc)
    report.moderator_note = moderator_note

    action_name = 'resolve_report' if normalized_status == 'reviewed' else 'dismiss_report'
    log_action(
        db, moderator.id, action_name, 'report', report.id,
        reason=moderator_note,
        university=report.university
    )

    db.commit()
    return {"success": True}


# ========================================
# ОБЖАЛОВАНИЯ (APPEALS)
# ========================================


@router.post("/appeals")
def create_appeal(
    data: schemas.AppealCreate = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Обжаловать действие модерации"""
    user = get_user_or_404(db, telegram_id)

    # Проверяем что лог существует и касается этого юзера
    mod_log = db.query(models.ModerationLog).filter(
        models.ModerationLog.id == data.moderation_log_id
    ).first()

    if not mod_log:
        raise HTTPException(status_code=404, detail="Действие модерации не найдено")

    if mod_log.target_user_id != user.id:
        raise HTTPException(status_code=403, detail="Вы можете обжаловать только действия над вашим контентом")

    # Проверка дубликата
    existing = db.query(models.Appeal).filter(
        models.Appeal.user_id == user.id,
        models.Appeal.moderation_log_id == data.moderation_log_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Вы уже подали апелляцию на это действие")

    appeal = models.Appeal(
        user_id=user.id,
        moderation_log_id=data.moderation_log_id,
        message=data.message,
        status='pending'
    )

    db.add(appeal)
    db.commit()
    db.refresh(appeal)

    return {"success": True, "appeal_id": appeal.id}


@router.get("/appeals")
def get_appeals(
    telegram_id: int = Query(...),
    status: str = Query('pending'),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db_sync)
):
    """Список обжалований (только суперадмин)"""
    admin = require_superadmin(get_user_or_404(db, telegram_id))

    query = db.query(models.Appeal).options(
        joinedload(models.Appeal.user),
        joinedload(models.Appeal.moderation_log)
    )

    if status and status != 'all':
        query = query.filter(models.Appeal.status == status)

    total = query.count()
    appeals = query.order_by(models.Appeal.created_at.desc()).offset(offset).limit(limit).all()

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
            "reviewed_at": a.reviewed_at
        })

    return {"items": items, "total": total, "has_more": offset + limit < total}


@router.patch("/appeals/{appeal_id}")
def review_appeal(
    appeal_id: int,
    status: str = Query(..., pattern="^(approved|rejected)$"),
    reviewer_note: Optional[str] = Query(None),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Рассмотреть обжалование (суперадмин). Approved = откат действия."""
    admin = require_superadmin(get_user_or_404(db, telegram_id))

    appeal = db.query(models.Appeal).options(
        joinedload(models.Appeal.moderation_log)
    ).filter(models.Appeal.id == appeal_id).first()

    if not appeal:
        raise HTTPException(status_code=404, detail="Апелляция не найдена")
    if appeal.status != 'pending':
        raise HTTPException(status_code=400, detail="Апелляция уже рассмотрена")

    appeal.status = status
    appeal.reviewed_by = admin.id
    appeal.reviewed_at = datetime.now(timezone.utc)
    appeal.reviewer_note = reviewer_note

    # Если одобрено — откатываем действие
    if status == 'approved':
        _rollback_moderation(db, appeal.moderation_log, admin.id)

    log_action(
        db, admin.id,
        'approve_appeal' if status == 'approved' else 'reject_appeal',
        'appeal', appeal.id,
        target_user_id=appeal.user_id,
        reason=reviewer_note
    )

    db.commit()
    return {"success": True}


def _rollback_moderation(db: Session, mod_log: models.ModerationLog, admin_id: int):
    """Откат действия модерации (восстановление контента / снятие бана)"""
    if not mod_log:
        return

    if mod_log.action == 'delete_post':
        post = db.query(models.Post).filter(models.Post.id == mod_log.target_id).first()
        if post:
            post.is_deleted = False
            post.deleted_by = None
            post.deleted_reason = None
            post.deleted_at = None
            log_action(db, admin_id, 'restore_post', 'post', post.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'delete_comment':
        comment = db.query(models.Comment).filter(models.Comment.id == mod_log.target_id).first()
        if comment:
            comment.is_deleted = False
            comment.deleted_by = None
            comment.deleted_reason = None
            comment.body = "[Восстановлен модератором]"  # оригинал утерян при soft delete
            # Восстанавливаем счётчик
            post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
            if post:
                post.comments_count += 1
            log_action(db, admin_id, 'restore_comment', 'comment', comment.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'delete_request':
        request = db.query(models.Request).filter(models.Request.id == mod_log.target_id).first()
        if request:
            request.is_deleted = False
            request.deleted_by = None
            request.deleted_reason = None
            request.deleted_at = None
            log_action(db, admin_id, 'restore_request', 'request', request.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'delete_market_item':
        item = db.query(models.MarketItem).filter(models.MarketItem.id == mod_log.target_id).first()
        if item:
            item.is_deleted = False
            item.deleted_by = None
            item.deleted_reason = None
            item.deleted_at = None
            log_action(db, admin_id, 'restore_market_item', 'market_item', item.id, target_user_id=mod_log.target_user_id)

    elif mod_log.action == 'shadow_ban':
        target = db.query(models.User).filter(models.User.id == mod_log.target_id).first()
        if target:
            target.is_shadow_banned_posts = False
            target.is_shadow_banned_comments = False
            target.shadow_ban_expires_at = None
            target.shadow_ban_reason = None
            log_action(db, admin_id, 'shadow_unban', 'user', target.id, target_user_id=target.id)


# ========================================
# АДМИНКА: АМБАССАДОРЫ
# ========================================


@router.get("/admin/ambassadors")
def list_ambassadors(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Список всех амбассадоров (суперадмин)"""
    admin = require_superadmin(get_user_or_404(db, telegram_id))

    ambassadors = db.query(models.User).filter(
        models.User.role == 'ambassador'
    ).order_by(models.User.university, models.User.name).all()

    result = []
    for amb in ambassadors:
        # Считаем действия за всё время
        actions_count = db.query(func.count(models.ModerationLog.id)).filter(
            models.ModerationLog.moderator_id == amb.id
        ).scalar()

        result.append({
            "id": amb.id,
            "telegram_id": amb.telegram_id,
            "name": amb.name,
            "username": amb.username,
            "university": amb.university,
            "institute": amb.institute,
            "role": amb.role,
            "actions_count": actions_count,
            "assigned_at": amb.updated_at
        })

    return {"ambassadors": result, "total": len(result)}


@router.post("/admin/ambassadors")
def assign_ambassador(
    data: schemas.AssignAmbassadorRequest = Body(...),
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Назначить амбассадора (суперадмин)"""
    admin = require_superadmin(get_user_or_404(db, telegram_id))

    target = db.query(models.User).filter(models.User.telegram_id == data.telegram_id).first()
    if not target:
        raise HTTPException(status_code=404, detail=f"Пользователь с telegram_id={data.telegram_id} не найден")

    if target.role == 'ambassador':
        raise HTTPException(status_code=400, detail="Пользователь уже амбассадор")
    if target.role == 'superadmin':
        raise HTTPException(status_code=400, detail="Нельзя понизить суперадмина до амбассадора")

    # Если указан вуз — проверяем совпадение (безопасность)
    if data.university and data.university != target.university:
        raise HTTPException(
            status_code=400,
            detail=f"Университет пользователя ({target.university}) не совпадает с указанным ({data.university})"
        )

    target.role = 'ambassador'

    log_action(
        db, admin.id, 'assign_ambassador', 'user', target.id,
        target_user_id=target.id,
        reason=f"Назначен амбассадором {target.university}",
        university=target.university
    )

    db.commit()
    return {
        "success": True,
        "ambassador": {
            "id": target.id,
            "name": target.name,
            "university": target.university,
            "telegram_id": target.telegram_id
        }
    }


@router.delete("/admin/ambassadors/{user_id}")
def remove_ambassador(
    user_id: int,
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Снять роль амбассадора (суперадмин)"""
    admin = require_superadmin(get_user_or_404(db, telegram_id))

    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.role != 'ambassador':
        raise HTTPException(status_code=400, detail="Пользователь не является амбассадором")

    target.role = 'user'

    log_action(
        db, admin.id, 'remove_ambassador', 'user', target.id,
        target_user_id=target.id,
        reason=f"Снят с роли амбассадора {target.university}",
        university=target.university
    )

    db.commit()
    return {"success": True}


# ========================================
# АДМИНКА: ЛОГИ
# ========================================


@router.get("/admin/logs")
def get_moderation_logs(
    telegram_id: int = Query(...),
    moderator_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db_sync)
):
    """Лог модерации (суперадмин — все, амбассадор — свои действия)"""
    user = require_moderator(get_user_or_404(db, telegram_id))

    query = db.query(models.ModerationLog).options(
        joinedload(models.ModerationLog.moderator),
        joinedload(models.ModerationLog.target_user)
    )

    # Амбассадор видит только свои логи
    if user.role == 'ambassador':
        query = query.filter(models.ModerationLog.moderator_id == user.id)
    else:
        if moderator_id:
            query = query.filter(models.ModerationLog.moderator_id == moderator_id)

    if action:
        query = query.filter(models.ModerationLog.action == action)
    if university:
        query = query.filter(models.ModerationLog.university == university)

    total = query.count()
    logs = query.order_by(models.ModerationLog.created_at.desc()).offset(offset).limit(limit).all()

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
            "created_at": log.created_at
        })

    return {"items": items, "total": total, "has_more": offset + limit < total}


# ========================================
# АДМИНКА: СТАТИСТИКА
# ========================================


@router.get("/admin/stats")
def get_admin_stats(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Общая статистика приложения (суперадмин)"""
    admin = require_superadmin(get_user_or_404(db, telegram_id))

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Пользователи
    total_users = db.query(func.count(models.User.id)).scalar()
    dau = db.query(func.count(models.User.id)).filter(models.User.last_active_at >= day_ago).scalar()
    wau = db.query(func.count(models.User.id)).filter(models.User.last_active_at >= week_ago).scalar()
    mau = db.query(func.count(models.User.id)).filter(models.User.last_active_at >= month_ago).scalar()

    # Контент
    total_posts = db.query(func.count(models.Post.id)).filter(models.Post.is_deleted == False).scalar()
    total_comments = db.query(func.count(models.Comment.id)).filter(models.Comment.is_deleted == False).scalar()
    total_requests = db.query(func.count(models.Request.id)).filter(models.Request.is_deleted == False).scalar()
    total_market = db.query(func.count(models.MarketItem.id)).filter(models.MarketItem.is_deleted == False).scalar()

    # Модерация
    pending_reports = db.query(func.count(models.Report.id)).filter(models.Report.status == 'pending').scalar()
    pending_appeals = db.query(func.count(models.Appeal.id)).filter(models.Appeal.status == 'pending').scalar()
    ambassadors_count = db.query(func.count(models.User.id)).filter(models.User.role == 'ambassador').scalar()
    actions_today = db.query(func.count(models.ModerationLog.id)).filter(
        models.ModerationLog.created_at >= day_ago
    ).scalar()

    # Топ вузов по пользователям
    top_unis = db.query(
        models.User.university,
        func.count(models.User.id).label('count')
    ).group_by(models.User.university).order_by(desc('count')).limit(10).all()

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
        ]
    }


# ========================================
# ИНФОРМАЦИЯ О РОЛИ (для фронта)
# ========================================


@router.get("/moderation/my-role")
def get_my_moderation_role(
    telegram_id: int = Query(...),
    db: Session = Depends(get_db_sync)
):
    """Получить свою роль и возможности (для UI)"""
    user = get_user_or_404(db, telegram_id)

    # Автоснятие истёкших банов
    auto_expire_shadow_bans(db)

    result = {
        "role": user.role,
        "university": user.university,
        "can_moderate": user.role in ('ambassador', 'superadmin'),
        "can_admin": user.role == 'superadmin',
        "scope": "all" if user.role == 'superadmin' else user.university if user.role == 'ambassador' else None
    }

    # Для модераторов — счётчик pending жалоб
    if user.role in ('ambassador', 'superadmin'):
        reports_query = db.query(func.count(models.Report.id)).filter(models.Report.status == 'pending')
        if user.role == 'ambassador':
            reports_query = reports_query.filter(models.Report.university == user.university)
        result["pending_reports"] = reports_query.scalar()

    return result

