# ===== 📄 ФАЙЛ: backend/app/crud/comments.py =====
# Comments CRUD: создание, удаление, редактирование, лайки

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional, List

from app import models, schemas
from app.services import notification_service as notif


# ===== ЛАЙКИ КОММЕНТАРИЕВ =====

def is_comment_liked_by_user(db: Session, comment_id: int, user_id: int) -> bool:
    like = db.query(models.CommentLike).filter(
        models.CommentLike.comment_id == comment_id,
        models.CommentLike.user_id == user_id
    ).first()
    return like is not None


def toggle_comment_like(db: Session, comment_id: int, user_id: int) -> dict:
    like = db.query(models.CommentLike).filter(
        models.CommentLike.comment_id == comment_id,
        models.CommentLike.user_id == user_id
    ).first()

    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"is_liked": False, "likes": 0}

    if like:
        db.delete(like)
        comment.likes_count = max(0, comment.likes_count - 1)
        db.commit()
        return {"is_liked": False, "likes": comment.likes_count}
    else:
        new_like = models.CommentLike(user_id=user_id, comment_id=comment_id)
        db.add(new_like)
        comment.likes_count += 1
        db.commit()
        return {"is_liked": True, "likes": comment.likes_count}


# ===== ПОЛУЧЕНИЕ =====

def get_post_comments(db: Session, post_id: int, user_id: Optional[int] = None) -> List[models.Comment]:
    """Получить комментарии к посту (с фильтрацией shadow ban)"""
    query = db.query(models.Comment)\
        .options(joinedload(models.Comment.author))\
        .filter(models.Comment.post_id == post_id)

    # Shadow ban: забаненный видит свои комменты, остальные — нет
    if user_id:
        query = query.join(models.User, models.Comment.author_id == models.User.id).filter(
            or_(
                models.User.is_shadow_banned_comments == False,
                models.Comment.author_id == user_id
            )
        )
    else:
        query = query.join(models.User, models.Comment.author_id == models.User.id).filter(
            models.User.is_shadow_banned_comments == False
        )

    comments = query.order_by(models.Comment.created_at).all()

    if user_id:
        for comment in comments:
            comment.is_liked = is_comment_liked_by_user(db, comment.id, user_id)
    else:
        for comment in comments:
            comment.is_liked = False

    return comments


def count_post_comments(db: Session, post_id: int) -> int:
    return db.query(models.Comment).filter(
        models.Comment.post_id == post_id,
        models.Comment.is_deleted == False
    ).count()


# ===== СОЗДАНИЕ =====

def create_comment(db: Session, comment: schemas.CommentCreate, author_id: int):
    """Создание комментария с логикой анонимности"""
    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()
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
            existing_anon_comments = db.query(models.Comment)\
                .filter(
                    models.Comment.post_id == comment.post_id,
                    models.Comment.is_anonymous == True
                ).all()

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

    post.comments_count += 1
    db.add(db_comment)
    db.flush()

    # --- Уведомления ---
    commenter = db.query(models.User).get(author_id)
    if commenter:
        if comment.parent_id:
            parent = db.query(models.Comment).get(comment.parent_id)
            if parent:
                notif.notify_comment_reply(db, parent, db_comment, commenter)
        else:
            notif.notify_new_comment(db, post, db_comment, commenter)

    db.commit()
    db.refresh(db_comment)
    return db_comment


# ===== РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ =====

def update_comment(db: Session, comment_id: int, text: str, user_id: int) -> Optional[models.Comment]:
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return None

    if comment.author_id != user_id:
        return None

    if comment.is_deleted:
        return None

    comment.body = text
    comment.is_edited = True
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment_id: int, user_id: int) -> dict:
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return {"success": False, "error": "Комментарий не найден"}

    if comment.author_id != user_id:
        return {"success": False, "error": "Нет прав"}

    post = db.query(models.Post).filter(models.Post.id == comment.post_id).first()

    has_replies = db.query(models.Comment).filter(models.Comment.parent_id == comment_id).count() > 0

    if has_replies:
        comment.is_deleted = True
        comment.body = "Комментарий удалён"
        db.commit()
        return {"success": True, "type": "soft_delete"}
    else:
        db.delete(comment)
        if post:
            post.comments_count = max(0, post.comments_count - 1)
        db.commit()
        return {"success": True, "type": "hard_delete"}