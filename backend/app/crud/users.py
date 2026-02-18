# ===== 📄 ФАЙЛ: backend/app/crud/users.py =====
# User CRUD: создание, обновление, кампус, cooldown, статистика

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, Dict
from datetime import datetime, timezone

from app import models, schemas
from app.crud.helpers import sanitize_json_field


# ===== БАЗОВЫЕ ОПЕРАЦИИ =====

def get_user_by_telegram_id(db: Session, telegram_id: int) -> Optional[models.User]:
    """Найти пользователя по Telegram ID"""
    return db.query(models.User).filter(models.User.telegram_id == telegram_id).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    """Найти пользователя по ID"""
    return db.query(models.User).filter(models.User.id == user_id).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    """Создать нового пользователя"""
    user_data = user.model_dump()

    db_user = models.User(
        **user_data,
        show_in_dating=True,
        hide_course_group=False,
        interests="[]"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate) -> Optional[models.User]:
    """Обновить данные пользователя"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None

    update_data = user_update.model_dump(exclude_unset=True)

    if 'interests' in update_data:
        update_data['interests'] = sanitize_json_field(update_data['interests'])

    for key, value in update_data.items():
        setattr(db_user, key, value)

    db_user.last_profile_edit = datetime.now(timezone.utc)

    db.commit()
    db.refresh(db_user)
    return db_user


# ===== CAMPUS MANAGEMENT =====

def get_unbound_users(
    db: Session,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict:
    """Юзеры без привязки к кампусу (campus_id == null)."""
    query = db.query(models.User).filter(
        models.User.campus_id.is_(None),
        models.User.university.isnot(None),
    )

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                models.User.custom_university.ilike(term),
                models.User.university.ilike(term),
                models.User.name.ilike(term),
                models.User.custom_city.ilike(term),
            )
        )

    total = query.count()
    users = query.order_by(models.User.created_at.desc()).offset(offset).limit(limit).all()

    return {"items": users, "total": total, "has_more": offset + limit < total}


def bind_user_to_campus(
    db: Session,
    user_id: int,
    campus_id: str,
    university: str,
    city: Optional[str] = None,
) -> Optional[models.User]:
    """Привязать юзера к кампусу (амбассадор/админ)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None

    user.campus_id = campus_id
    user.university = university
    user.city = city
    user.custom_university = None
    user.custom_city = None
    user.custom_faculty = None

    db.commit()
    db.refresh(user)
    return user


def unbind_user_from_campus(db: Session, user_id: int) -> Optional[models.User]:
    """Отвязать юзера от кампуса (вернуть в custom)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None

    user.custom_university = user.university
    user.custom_city = user.city
    user.campus_id = None

    db.commit()
    db.refresh(user)
    return user


# ===== COOLDOWN =====

def can_edit_critical_fields(db: Session, user_id: int) -> bool:
    user = get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return True
    days_passed = (datetime.now(timezone.utc) - user.last_profile_edit).days
    return days_passed >= 30


def get_cooldown_days_left(db: Session, user_id: int) -> int:
    user = get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return 0
    days_passed = (datetime.now(timezone.utc) - user.last_profile_edit).days
    return max(0, 30 - days_passed)


# ===== СТАТИСТИКА =====

def count_user_posts(db: Session, user_id: int) -> int:
    return db.query(models.Post).filter(
        models.Post.author_id == user_id,
        models.Post.is_deleted == False
    ).count()


def count_user_comments(db: Session, user_id: int) -> int:
    return db.query(models.Comment).filter(
        models.Comment.author_id == user_id,
        models.Comment.is_deleted == False
    ).count()


def count_user_total_likes(db: Session, user_id: int) -> int:
    """Суммарное количество полученных лайков (за посты + за комментарии)"""
    post_likes = db.query(func.sum(models.Post.likes_count)).filter(
        models.Post.author_id == user_id,
        models.Post.is_anonymous == False
    ).scalar() or 0

    comment_likes = db.query(func.sum(models.Comment.likes_count)).filter(
        models.Comment.author_id == user_id,
        models.Comment.is_anonymous == False
    ).scalar() or 0

    return int(post_likes + comment_likes)