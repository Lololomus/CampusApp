# ===== 📄 ФАЙЛ: backend/app/crud/users.py =====
# User CRUD: создание, обновление, кампус, cooldown, статистика
#
# ✅ Фаза 1.4: interests → JSONB, передаём list напрямую вместо json.dumps()
# ✅ Фаза 3: async/await + select() + AsyncSession

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, Dict
from datetime import datetime, timezone

from app import models, schemas
from app.crud.helpers import sanitize_json_field


# ===== БАЗОВЫЕ ОПЕРАЦИИ =====

async def get_user_by_telegram_id(db: AsyncSession, telegram_id: int) -> Optional[models.User]:
    """Найти пользователя по Telegram ID"""
    result = await db.execute(
        select(models.User).where(models.User.telegram_id == telegram_id)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[models.User]:
    """Найти пользователя по ID"""
    return await db.get(models.User, user_id)


async def create_user(db: AsyncSession, user: schemas.UserCreate) -> models.User:
    """Создать нового пользователя"""
    user_data = user.model_dump()

    db_user = models.User(
        **user_data,
        show_in_dating=True,
        hide_course_group=False,
        interests=[]                           # ✅ JSONB: list напрямую
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


_ALLOWED_USER_UPDATE_FIELDS = {
    "username", "name", "age", "bio", "avatar",
    "university", "institute", "course", "group",
    "campus_id", "city", "custom_university", "custom_city", "custom_faculty",
    "interests", "show_profile", "show_telegram_id",
    "show_in_dating", "hide_course_group",
}

async def update_user(db: AsyncSession, user_id: int, user_update: schemas.UserUpdate) -> Optional[models.User]:
    """Обновить данные пользователя"""
    db_user = await db.get(models.User, user_id)
    if not db_user:
        return None

    update_data = user_update.model_dump(exclude_unset=True)

    if 'interests' in update_data:
        update_data['interests'] = sanitize_json_field(update_data['interests'])  # ✅ JSONB: list

    for key, value in update_data.items():
        if key in _ALLOWED_USER_UPDATE_FIELDS:
            setattr(db_user, key, value)

    db_user.last_profile_edit = datetime.utcnow()

    await db.commit()
    await db.refresh(db_user)
    return db_user


# ===== CAMPUS MANAGEMENT =====

async def get_unbound_users(
    db: AsyncSession,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict:
    """Юзеры без привязки к кампусу (campus_id == null)."""
    base = select(models.User).where(
        models.User.campus_id.is_(None),
        models.User.university.isnot(None),
    )

    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                models.User.custom_university.ilike(term),
                models.User.university.ilike(term),
                models.User.name.ilike(term),
                models.User.custom_city.ilike(term),
            )
        )

    total = await db.scalar(
        select(func.count()).select_from(base.subquery())
    )

    result = await db.execute(
        base.order_by(models.User.created_at.desc()).offset(offset).limit(limit)
    )
    users = result.scalars().all()

    return {"items": users, "total": total, "has_more": offset + limit < total}


async def bind_user_to_campus(
    db: AsyncSession,
    user_id: int,
    campus_id: str,
    university: str,
    city: Optional[str] = None,
) -> Optional[models.User]:
    """Привязать юзера к кампусу (амбассадор/админ)."""
    user = await db.get(models.User, user_id)
    if not user:
        return None

    user.campus_id = campus_id
    user.university = university
    user.city = city
    user.custom_university = None
    user.custom_city = None
    user.custom_faculty = None

    await db.commit()
    await db.refresh(user)
    return user


async def unbind_user_from_campus(db: AsyncSession, user_id: int) -> Optional[models.User]:
    """Отвязать юзера от кампуса (вернуть в custom)."""
    user = await db.get(models.User, user_id)
    if not user:
        return None

    user.custom_university = user.university
    user.custom_city = user.city
    user.campus_id = None

    await db.commit()
    await db.refresh(user)
    return user


# ===== COOLDOWN =====

async def can_edit_critical_fields(db: AsyncSession, user_id: int) -> bool:
    user = await get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return True
    days_passed = (datetime.utcnow() - user.last_profile_edit).days
    return days_passed >= 30


async def get_cooldown_days_left(db: AsyncSession, user_id: int) -> int:
    user = await get_user_by_id(db, user_id)
    if not user or not user.last_profile_edit:
        return 0
    days_passed = (datetime.utcnow() - user.last_profile_edit).days
    return max(0, 30 - days_passed)


# ===== СТАТИСТИКА =====

async def count_user_posts(db: AsyncSession, user_id: int) -> int:
    result = await db.scalar(
        select(func.count(models.Post.id)).where(
            models.Post.author_id == user_id,
            models.Post.is_deleted == False
        )
    )
    return result or 0


async def count_user_comments(db: AsyncSession, user_id: int) -> int:
    result = await db.scalar(
        select(func.count(models.Comment.id)).where(
            models.Comment.author_id == user_id,
            models.Comment.is_deleted == False
        )
    )
    return result or 0


async def count_user_total_likes(db: AsyncSession, user_id: int) -> int:
    """Суммарное количество полученных лайков (за посты + за комментарии)"""
    post_likes = await db.scalar(
        select(func.sum(models.Post.likes_count)).where(
            models.Post.author_id == user_id,
            models.Post.is_anonymous == False
        )
    ) or 0

    comment_likes = await db.scalar(
        select(func.sum(models.Comment.likes_count)).where(
            models.Comment.author_id == user_id,
            models.Comment.is_anonymous == False
        )
    ) or 0

    return int(post_likes + comment_likes)