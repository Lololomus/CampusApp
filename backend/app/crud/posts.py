# ===== 📄 ФАЙЛ: backend/app/crud/posts.py =====
# Posts CRUD: создание, обновление, лента, лайки, просмотры, опросы
#
# ✅ Фаза 1.4: Убраны json.loads()/json.dumps() — JSONB-колонки возвращают
#    нативные list/dict. sanitize_json_field() тоже возвращает list/dict.
# ✅ Фаза 3.4: async/await + select() + AsyncSession
# ✅ Фаза 3.4: joinedload → selectinload

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update as sa_update
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import logging

from app import models, schemas
from app.crud.helpers import sanitize_json_field
from app.utils import delete_images, get_storage_key, process_base64_images
from app.services import notification_service as notif

logger = logging.getLogger(__name__)


# ===== ЛЕНТА И ПОЛУЧЕНИЕ =====

async def get_posts(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    university: Optional[str] = None,
    institute: Optional[str] = None,
    campus_id: Optional[str] = None,
    city: Optional[str] = None,
    tags: Optional[str] = None,
    date_range: Optional[str] = None,
    sort: str = 'newest',
    current_user_id: Optional[int] = None,
) -> List[models.Post]:
    """Получение постов с фильтрацией + soft delete + shadow ban"""
    query = (
        select(models.Post)
        .options(
            selectinload(models.Post.author),
            selectinload(models.Post.poll).selectinload(models.Poll.votes),
        )
    )

    # Фильтр soft delete
    query = query.where(models.Post.is_deleted == False)

    # Исключаем рекламные посты из обычной ленты
    ad_post_ids = select(models.AdPost.post_id).scalar_subquery()
    query = query.where(~models.Post.id.in_(ad_post_ids))

    # Фильтр shadow ban (забаненный видит свои посты, остальные — нет)
    if current_user_id:
        query = query.join(models.User, models.Post.author_id == models.User.id).where(
            or_(
                models.User.is_shadow_banned_posts == False,
                models.Post.author_id == current_user_id
            )
        )
    else:
        query = query.join(models.User, models.Post.author_id == models.User.id).where(
            models.User.is_shadow_banned_posts == False
        )

    # Фильтр по категории
    if category and category != 'all':
        query = query.where(models.Post.category == category)

    # === ФИЛЬТРАЦИЯ ПО ЛОКАЦИИ (4 уровня) ===
    if campus_id:
        query = query.where(models.User.campus_id == campus_id)
    elif university and university != 'all':
        query = query.where(models.User.university == university)
    elif city:
        query = query.where(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%')
            )
        )

    # Фильтр по институту
    if institute and institute != 'all':
        query = query.where(models.User.institute == institute)

    # Фильтр по тегам
    if tags:
        tags_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        if tags_list:
            # ✅ JSONB: используем оператор @> для проверки вхождения
            from sqlalchemy import cast
            from sqlalchemy.dialects.postgresql import JSONB as JSONB_TYPE
            tag_conditions = [models.Post.tags.op('@>')(cast([tag], JSONB_TYPE)) for tag in tags_list]
            query = query.where(or_(*tag_conditions))

    # Фильтр по дате
    if date_range:
        now = datetime.utcnow()
        if date_range == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.where(models.Post.created_at >= start_date)
        elif date_range == 'week':
            start_date = now - timedelta(days=7)
            query = query.where(models.Post.created_at >= start_date)
        elif date_range == 'month':
            start_date = now - timedelta(days=30)
            query = query.where(models.Post.created_at >= start_date)

    # Сортировка
    if sort == 'popular':
        query = query.order_by(
            models.Post.is_important.desc(),
            models.Post.likes_count.desc(),
            models.Post.created_at.desc()
        )
    elif sort == 'discussed':
        query = query.order_by(
            models.Post.is_important.desc(),
            models.Post.comments_count.desc(),
            models.Post.created_at.desc()
        )
    else:
        query = query.order_by(
            models.Post.is_important.desc(),
            models.Post.created_at.desc()
        )

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_post(db: AsyncSession, post_id: int) -> Optional[models.Post]:
    """Получить пост по ID (только неудалённые)"""
    result = await db.execute(
        select(models.Post)
        .options(
            selectinload(models.Post.author),
            selectinload(models.Post.poll).selectinload(models.Poll.votes),
        )
        .where(
            models.Post.id == post_id,
            models.Post.is_deleted == False
        )
    )
    return result.scalar_one_or_none()


async def get_user_posts(db: AsyncSession, user_id: int, limit: int = 5, offset: int = 0) -> List[models.Post]:
    result = await db.execute(
        select(models.Post)
        .where(
            models.Post.author_id == user_id,
            models.Post.is_deleted == False
        )
        .order_by(models.Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


# ===== СОЗДАНИЕ И ОБНОВЛЕНИЕ =====

async def create_post(
    db: AsyncSession,
    post: schemas.PostCreate,
    author_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.Post:
    """Создать новый пост."""
    # Rate Limiting (10 постов в час)
    recent_posts_count = await db.scalar(
        select(func.count(models.Post.id)).where(
            models.Post.author_id == author_id,
            models.Post.created_at > datetime.utcnow() - timedelta(hours=1)
        )
    )

    if (recent_posts_count or 0) >= 10:
        raise ValueError("Превышен лимит создания постов (10 в час)")

    # Fallback на base64, если images_meta не переданы
    saved_images_meta = images_meta or []
    if not saved_images_meta and post.images and len(post.images) > 0:
        try:
            saved_images_meta = process_base64_images(post.images)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки изображений: {str(e)}")

    db_post = models.Post(
        author_id=author_id,
        category=post.category,
        title=post.title,
        body=post.body,
        tags=sanitize_json_field(post.tags),
        images=sanitize_json_field(saved_images_meta),
        is_anonymous=post.is_anonymous,
        enable_anonymous_comments=post.enable_anonymous_comments,
        lost_or_found=post.lost_or_found,
        item_description=post.item_description,
        location=post.location,
        reward_type=post.reward_type,
        reward_value=post.reward_value,
        event_name=post.event_name,
        event_date=post.event_date,
        event_location=post.event_location,
        event_contact=post.event_contact,
        is_important=post.is_important,
        likes_count=0,
        comments_count=0,
        views_count=0
    )

    try:
        db.add(db_post)
        await db.commit()
        await db.refresh(db_post)
        return db_post
    except Exception as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e


async def update_post(
    db: AsyncSession,
    post_id: int,
    post_update: schemas.PostUpdate,
    new_images_meta: Optional[List[dict]] = None,
    keep_filenames: Optional[List[str]] = None,
) -> Optional[models.Post]:
    """Update post (smart image merge)."""
    db_post = await db.get(models.Post, post_id)
    if not db_post:
        return None

    update_data = post_update.model_dump(exclude_unset=True)

    if "tags" in update_data:
        update_data["tags"] = sanitize_json_field(update_data["tags"])

    files_to_delete: List[str] = []

    if new_images_meta is not None or keep_filenames is not None:
        # ✅ JSONB: db_post.images уже list
        raw_old_images = db_post.images or []

        old_images_map: Dict[str, dict] = {}
        for item in raw_old_images:
            if isinstance(item, str):
                key = get_storage_key(item, kind="images")
                if key:
                    old_images_map[key] = {"url": key, "w": 1000, "h": 1000}
            elif isinstance(item, dict):
                key = get_storage_key(item.get("url", ""), kind="images")
                if key:
                    normalized_item = dict(item)
                    normalized_item["url"] = key
                    normalized_item.setdefault("w", 1000)
                    normalized_item.setdefault("h", 1000)
                    old_images_map[key] = normalized_item

        final_images_meta: List[dict] = []

        if keep_filenames:
            for fname in keep_filenames:
                key = get_storage_key(fname, kind="images")
                if key and key in old_images_map:
                    final_images_meta.append(old_images_map[key])

        if new_images_meta:
            final_images_meta.extend(new_images_meta)

        kept_urls = {get_storage_key(img.get("url", ""), kind="images") for img in final_images_meta}
        kept_urls.discard("")
        files_to_delete = [url for url in old_images_map if url not in kept_urls]

        update_data["images"] = sanitize_json_field(final_images_meta)

    for key, value in update_data.items():
        setattr(db_post, key, value)

    db_post.updated_at = datetime.utcnow()

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        if new_images_meta:
            delete_images(new_images_meta)
        raise

    if files_to_delete:
        delete_images(files_to_delete)

    await db.refresh(db_post)
    return db_post


async def delete_post(db: AsyncSession, post_id: int) -> bool:
    """Удалить пост и его изображения"""
    db_post = await db.get(models.Post, post_id)
    if not db_post:
        return False

    if db_post.images:
        try:
            delete_images(db_post.images)
        except Exception as e:
            logger.warning("Ошибка удаления изображений поста %s: %s", post_id, e)

    await db.delete(db_post)
    await db.commit()
    return True


# ===== ПРОСМОТРЫ =====

async def increment_post_views(db: AsyncSession, post_id: int, user_id: int):
    """Увеличить счётчик просмотров поста (уникальные по юзеру)."""
    # Пропускаем рекламу (у неё свои views в AdPost)
    ad_check = await db.execute(
        select(models.AdPost.id).where(models.AdPost.post_id == post_id)
    )
    if ad_check.scalar_one_or_none():
        return

    view_check = await db.execute(
        select(models.PostView).where(
            models.PostView.post_id == post_id,
            models.PostView.user_id == user_id
        )
    )
    if view_check.scalar_one_or_none():
        return

    try:
        new_view = models.PostView(post_id=post_id, user_id=user_id)
        db.add(new_view)

        await db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post_id)
            .values(views_count=models.Post.views_count + 1)
        )

        await db.commit()
    except Exception:
        await db.rollback()


# ===== ЛАЙКИ ПОСТОВ =====

async def is_post_liked_by_user(db: AsyncSession, post_id: int, user_id: int) -> bool:
    """Проверить лайкнул ли пользователь пост"""
    result = await db.execute(
        select(models.PostLike).where(
            models.PostLike.post_id == post_id,
            models.PostLike.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def toggle_post_like(db: AsyncSession, post_id: int, user_id: int) -> dict:
    """Toggle лайка (добавить или убрать)"""
    result = await db.execute(
        select(models.PostLike).where(
            models.PostLike.post_id == post_id,
            models.PostLike.user_id == user_id
        )
    )
    like = result.scalar_one_or_none()

    post = await db.get(models.Post, post_id)
    if not post:
        return {"is_liked": False, "likes": 0}

    if like:
        await db.delete(like)
        await db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post_id)
            .values(likes_count=func.greatest(models.Post.likes_count - 1, 0))
        )
        await db.commit()
        await db.refresh(post)
        return {"is_liked": False, "likes": post.likes_count}
    else:
        new_like = models.PostLike(user_id=user_id, post_id=post_id)
        db.add(new_like)
        await db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post_id)
            .values(likes_count=models.Post.likes_count + 1)
        )
        await notif.check_milestone(db, post)
        await db.commit()
        await db.refresh(post)
        return {"is_liked": True, "likes": post.likes_count}


# ===== ОПРОСЫ (POLLS) =====

async def create_poll(db: AsyncSession, post_id: int, poll_data: schemas.PollCreate) -> models.Poll:
    """Создать опрос для поста"""
    options_json = [{"text": option_text, "votes": 0} for option_text in poll_data.options]

    db_poll = models.Poll(
        post_id=post_id,
        question=poll_data.question,
        options=options_json,
        type=poll_data.type,
        correct_option=poll_data.correct_option if poll_data.type == 'quiz' else None,
        allow_multiple=poll_data.allow_multiple,
        is_anonymous=poll_data.is_anonymous,
        closes_at=poll_data.closes_at,
        total_votes=0
    )

    db.add(db_poll)
    await db.commit()
    await db.refresh(db_poll)
    return db_poll


async def vote_poll(db: AsyncSession, poll_id: int, user_id: int, option_indices: List[int]) -> Dict:
    """Проголосовать в опросе"""
    poll = await db.get(models.Poll, poll_id)
    if not poll:
        raise ValueError("Опрос не найден")

    if poll.closes_at and poll.closes_at < datetime.utcnow():
        raise ValueError("Опрос закрыт")

    existing_vote_result = await db.execute(
        select(models.PollVote).where(
            models.PollVote.poll_id == poll_id,
            models.PollVote.user_id == user_id
        )
    )
    if existing_vote_result.scalar_one_or_none():
        raise ValueError("Вы уже проголосовали")

    # ✅ JSONB: poll.options уже list
    options_data = list(poll.options)  # copy чтобы не мутировать in-place
    for idx in option_indices:
        if idx < 0 or idx >= len(options_data):
            raise ValueError(f"Неверный индекс варианта: {idx}")

    if not poll.allow_multiple and len(option_indices) > 1:
        raise ValueError("Множественный выбор запрещен")

    for idx in option_indices:
        options_data[idx] = {**options_data[idx], 'votes': options_data[idx]['votes'] + 1}

    poll.options = options_data

    await db.execute(
        sa_update(models.Poll)
        .where(models.Poll.id == poll_id)
        .values(total_votes=models.Poll.total_votes + 1)
    )

    db_vote = models.PollVote(
        poll_id=poll_id,
        user_id=user_id,
        option_indices=option_indices
    )

    db.add(db_vote)
    await db.commit()

    return {
        "success": True,
        "is_correct": option_indices[0] == poll.correct_option if poll.type == 'quiz' else None
    }