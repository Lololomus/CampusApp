# ===== 📄 ФАЙЛ: backend/app/crud/comments.py =====
# Comments CRUD: создание, удаление, редактирование, лайки
#
# ✅ Фаза 3.3: async/await + select() + AsyncSession
# ✅ Фаза 3.3: legacy_query_api(Model).get(id) → await db.get(Model, id)
# ✅ Фаза 3.3: joinedload → selectinload (MissingGreenlet prevention)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, update as sa_update
from sqlalchemy.orm import selectinload
from typing import Optional, List

from app import models, schemas
from app.services import notification_service as notif


# ===== ЛАЙКИ КОММЕНТАРИЕВ =====

async def is_comment_liked_by_user(db: AsyncSession, comment_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(models.CommentLike).where(
            models.CommentLike.comment_id == comment_id,
            models.CommentLike.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def toggle_comment_like(db: AsyncSession, comment_id: int, user_id: int) -> dict:
    result = await db.execute(
        select(models.CommentLike).where(
            models.CommentLike.comment_id == comment_id,
            models.CommentLike.user_id == user_id
        )
    )
    like = result.scalar_one_or_none()

    comment = await db.get(models.Comment, comment_id)
    if not comment:
        return {"is_liked": False, "likes": 0}

    if like:
        await db.delete(like)
        await db.execute(
            sa_update(models.Comment)
            .where(models.Comment.id == comment_id)
            .values(likes_count=func.greatest(models.Comment.likes_count - 1, 0))
        )
        await db.commit()
        await db.refresh(comment)
        return {"is_liked": False, "likes": comment.likes_count}
    else:
        new_like = models.CommentLike(user_id=user_id, comment_id=comment_id)
        db.add(new_like)
        await db.execute(
            sa_update(models.Comment)
            .where(models.Comment.id == comment_id)
            .values(likes_count=models.Comment.likes_count + 1)
        )
        await db.commit()
        await db.refresh(comment)
        return {"is_liked": True, "likes": comment.likes_count}


# ===== ПОЛУЧЕНИЕ =====

async def get_post_comments(db: AsyncSession, post_id: int, user_id: Optional[int] = None) -> List[models.Comment]:
    """Получить комментарии к посту (с фильтрацией shadow ban)"""
    query = (
        select(models.Comment)
        .options(selectinload(models.Comment.author))
        .where(models.Comment.post_id == post_id)
    )

    # Shadow ban: забаненный видит свои комменты, остальные — нет
    if user_id:
        query = query.join(models.User, models.Comment.author_id == models.User.id).where(
            or_(
                models.User.is_shadow_banned_comments == False,
                models.Comment.author_id == user_id
            )
        )
    else:
        query = query.join(models.User, models.Comment.author_id == models.User.id).where(
            models.User.is_shadow_banned_comments == False
        )

    query = query.order_by(models.Comment.created_at)
    result = await db.execute(query)
    comments = result.scalars().all()

    # NOTE: N+1 здесь — Фаза 4.1 заменит на batch-запрос лайков
    if user_id:
        for comment in comments:
            comment.is_liked = await is_comment_liked_by_user(db, comment.id, user_id)
    else:
        for comment in comments:
            comment.is_liked = False

    return comments


async def count_post_comments(db: AsyncSession, post_id: int) -> int:
    result = await db.scalar(
        select(func.count(models.Comment.id)).where(
            models.Comment.post_id == post_id,
            models.Comment.is_deleted == False
        )
    )
    return result or 0


# ===== СОЗДАНИЕ =====

async def create_comment(db: AsyncSession, comment: schemas.CommentCreate, author_id: int):
    """Создание комментария с логикой анонимности"""
    result = await db.execute(
        select(models.Post).where(models.Post.id == comment.post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        return None

    is_anonymous = comment.is_anonymous
    if post.enable_anonymous_comments:
        is_anonymous = True

    anonymous_index = None
    if is_anonymous:
        if post.is_anonymous and post.author_id == author_id:
            anonymous_index = 0
        else:
            anon_result = await db.execute(
                select(models.Comment).where(
                    models.Comment.post_id == comment.post_id,
                    models.Comment.is_anonymous == True
                )
            )
            existing_anon_comments = anon_result.scalars().all()

            for existing in existing_anon_comments:
                if existing.author_id == author_id:
                    anonymous_index = existing.anonymous_index
                    break

            if anonymous_index is None:
                max_index = max(
                    [c.anonymous_index for c in existing_anon_comments if c.anonymous_index and c.anonymous_index > 0],
                    default=0
                )
                anonymous_index = max_index + 1

    db_comment = models.Comment(
        post_id=comment.post_id,
        author_id=author_id,
        body=comment.body,
        parent_id=comment.parent_id,
        is_anonymous=is_anonymous,
        anonymous_index=anonymous_index
    )

    db.add(db_comment)
    await db.execute(
        sa_update(models.Post)
        .where(models.Post.id == comment.post_id)
        .values(comments_count=models.Post.comments_count + 1)
    )
    await db.flush()

    # --- Уведомления ---
    # ✅ legacy_query_api(Model).get(id) → await db.get(Model, id)
    commenter = await db.get(models.User, author_id)
    if commenter:
        if comment.parent_id:
            parent = await db.get(models.Comment, comment.parent_id)
            if parent:
                await notif.notify_comment_reply(db, parent, db_comment, commenter)
        else:
            await notif.notify_new_comment(db, post, db_comment, commenter)

    await db.commit()
    await db.refresh(db_comment)
    return db_comment


# ===== РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ =====

async def update_comment(db: AsyncSession, comment_id: int, text: str, user_id: int) -> Optional[models.Comment]:
    comment = await db.get(models.Comment, comment_id)
    if not comment:
        return None

    if comment.author_id != user_id:
        return None

    if comment.is_deleted:
        return None

    comment.body = text
    comment.is_edited = True
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_comment(db: AsyncSession, comment_id: int, user_id: int) -> dict:
    comment = await db.get(models.Comment, comment_id)
    if not comment:
        return {"success": False, "error": "Комментарий не найден"}

    if comment.author_id != user_id:
        return {"success": False, "error": "Нет прав"}

    post = await db.get(models.Post, comment.post_id)

    replies_count = await db.scalar(
        select(func.count(models.Comment.id)).where(models.Comment.parent_id == comment_id)
    )
    has_replies = (replies_count or 0) > 0

    if has_replies:
        comment.is_deleted = True
        comment.body = "Комментарий удалён"
        await db.commit()
        return {"success": True, "type": "soft_delete"}
    else:
        await db.delete(comment)
        if post:
            await db.execute(
                sa_update(models.Post)
                .where(models.Post.id == post.id)
                .values(comments_count=func.greatest(models.Post.comments_count - 1, 0))
            )
        await db.commit()
        return {"success": True, "type": "hard_delete"}
