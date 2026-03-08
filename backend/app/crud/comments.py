# ===== FILE: backend/app/crud/comments.py =====
# Comments CRUD: create, update, delete, likes

from typing import List, Optional

from sqlalchemy import func, or_, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, schemas
from app.services import notification_service as notif
from app.utils import delete_images


# ===== COMMENT LIKES =====

async def is_comment_liked_by_user(db: AsyncSession, comment_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(models.CommentLike).where(
            models.CommentLike.comment_id == comment_id,
            models.CommentLike.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def toggle_comment_like(db: AsyncSession, comment_id: int, user_id: int) -> dict:
    result = await db.execute(
        select(models.CommentLike).where(
            models.CommentLike.comment_id == comment_id,
            models.CommentLike.user_id == user_id,
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


# ===== READ =====

async def get_post_comments(db: AsyncSession, post_id: int, user_id: Optional[int] = None) -> List[models.Comment]:
    query = (
        select(models.Comment)
        .options(selectinload(models.Comment.author))
        .where(models.Comment.post_id == post_id)
    )

    # Shadow ban: banned user sees own comments only.
    if user_id:
        query = query.join(models.User, models.Comment.author_id == models.User.id).where(
            or_(
                models.User.is_shadow_banned_comments == False,
                models.Comment.author_id == user_id,
            )
        )
    else:
        query = query.join(models.User, models.Comment.author_id == models.User.id).where(
            models.User.is_shadow_banned_comments == False
        )

    query = query.order_by(models.Comment.created_at)
    result = await db.execute(query)
    comments = result.scalars().all()

    # Batch load likes for current user.
    if user_id and comments:
        comment_ids = [c.id for c in comments]
        liked_result = await db.execute(
            select(models.CommentLike.comment_id).where(
                models.CommentLike.comment_id.in_(comment_ids),
                models.CommentLike.user_id == user_id,
            )
        )
        liked_ids = {row[0] for row in liked_result.all()}
        for comment in comments:
            comment.is_liked = comment.id in liked_ids
    else:
        for comment in comments:
            comment.is_liked = False

    return comments


async def count_post_comments(db: AsyncSession, post_id: int) -> int:
    result = await db.scalar(
        select(func.count(models.Comment.id)).where(
            models.Comment.post_id == post_id,
            models.Comment.is_deleted == False,
        )
    )
    return result or 0


# ===== CREATE =====

async def create_comment(db: AsyncSession, comment: schemas.CommentCreate, author_id: int):
    result = await db.execute(select(models.Post).where(models.Post.id == comment.post_id))
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
                    models.Comment.is_anonymous == True,
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
                    default=0,
                )
                anonymous_index = max_index + 1

    payload_images = [
        (img.model_dump() if hasattr(img, "model_dump") else img)
        for img in (comment.images or [])
    ]

    db_comment = models.Comment(
        post_id=comment.post_id,
        author_id=author_id,
        body=(comment.body or "").strip(),
        parent_id=comment.parent_id,
        is_anonymous=is_anonymous,
        anonymous_index=anonymous_index,
        images=payload_images,
    )

    db.add(db_comment)
    await db.execute(
        sa_update(models.Post)
        .where(models.Post.id == comment.post_id)
        .values(comments_count=models.Post.comments_count + 1)
    )
    await db.flush()

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


# ===== UPDATE / DELETE =====

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

    if comment.images:
        try:
            delete_images(comment.images, default_kind="images")
        except Exception:
            pass

    if has_replies:
        comment.is_deleted = True
        comment.body = "Комментарий удалён"
        comment.images = []
        await db.commit()
        return {"success": True, "type": "soft_delete"}

    await db.delete(comment)
    if post:
        await db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post.id)
            .values(comments_count=func.greatest(models.Post.comments_count - 1, 0))
        )
    await db.commit()
    return {"success": True, "type": "hard_delete"}
