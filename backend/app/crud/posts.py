# ===== 📄 ФАЙЛ: backend/app/crud/posts.py =====
# Posts CRUD: создание, обновление, лента, лайки, просмотры, опросы
#
# ⚠️ ИСПРАВЛЕНО: create_post и update_post были async def с sync DB-вызовами,
#    что блокировало event loop. Теперь они sync.
#    Обработка файлов (process_uploaded_files) вынесена на уровень endpoint.

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, update as sa_update
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import json

from app import models, schemas
from app.crud.helpers import sanitize_json_field
from app.utils import delete_images, get_storage_key, process_base64_images
from app.services import notification_service as notif


# ===== ЛЕНТА И ПОЛУЧЕНИЕ =====

def get_posts(
    db: Session,
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
    query = db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.poll).joinedload(models.Poll.votes)
    )

    # Фильтр soft delete
    query = query.filter(models.Post.is_deleted == False)

    # Исключаем рекламные посты из обычной ленты
    ad_post_ids = db.query(models.AdPost.post_id).subquery()
    query = query.filter(~models.Post.id.in_(ad_post_ids))

    # Фильтр shadow ban (забаненный видит свои посты, остальные — нет)
    if current_user_id:
        query = query.join(models.User, models.Post.author_id == models.User.id).filter(
            or_(
                models.User.is_shadow_banned_posts == False,
                models.Post.author_id == current_user_id
            )
        )
    else:
        query = query.join(models.User, models.Post.author_id == models.User.id).filter(
            models.User.is_shadow_banned_posts == False
        )

    # Фильтр по категории
    if category and category != 'all':
        query = query.filter(models.Post.category == category)

    # === ФИЛЬТРАЦИЯ ПО ЛОКАЦИИ (4 уровня) ===
    if campus_id:
        query = query.filter(models.User.campus_id == campus_id)
    elif university and university != 'all':
        query = query.filter(models.User.university == university)
    elif city:
        query = query.filter(
            or_(
                models.User.city == city,
                models.User.custom_city.ilike(f'%{city}%')
            )
        )

    # Фильтр по институту
    if institute and institute != 'all':
        query = query.filter(models.User.institute == institute)

    # Фильтр по тегам
    if tags:
        tags_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        if tags_list:
            tag_conditions = [models.Post.tags.like(f'%"{tag}"%') for tag in tags_list]
            query = query.filter(or_(*tag_conditions))

    # Фильтр по дате
    if date_range:
        now = datetime.now(timezone.utc)
        if date_range == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(models.Post.created_at >= start_date)
        elif date_range == 'week':
            start_date = now - timedelta(days=7)
            query = query.filter(models.Post.created_at >= start_date)
        elif date_range == 'month':
            start_date = now - timedelta(days=30)
            query = query.filter(models.Post.created_at >= start_date)

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

    return query.offset(skip).limit(limit).all()


def get_post(db: Session, post_id: int) -> Optional[models.Post]:
    """Получить пост по ID (только неудалённые)"""
    return db.query(models.Post).options(
        joinedload(models.Post.author),
        joinedload(models.Post.poll).joinedload(models.Poll.votes)
    ).filter(
        models.Post.id == post_id,
        models.Post.is_deleted == False
    ).first()


def get_user_posts(db: Session, user_id: int, limit: int = 5, offset: int = 0) -> List[models.Post]:
    return db.query(models.Post)\
        .filter(
            models.Post.author_id == user_id,
            models.Post.is_deleted == False
        )\
        .order_by(models.Post.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()


# ===== СОЗДАНИЕ И ОБНОВЛЕНИЕ =====

def create_post(
    db: Session,
    post: schemas.PostCreate,
    author_id: int,
    images_meta: Optional[List[dict]] = None,
) -> models.Post:
    """
    Создать новый пост.

    ⚠️ Обработка файлов (process_uploaded_files) должна происходить в endpoint,
       а результат передаваться в images_meta. Пример вызова из endpoint:

        images_meta = []
        if uploaded_files:
            images_meta = await process_uploaded_files(uploaded_files)
        elif post.images:
            images_meta = process_base64_images(post.images)
        db_post = crud.create_post(db, post, user.id, images_meta=images_meta)
    """
    # Rate Limiting (10 постов в час)
    recent_posts_count = db.query(func.count(models.Post.id)).filter(
        models.Post.author_id == author_id,
        models.Post.created_at > datetime.now(timezone.utc) - timedelta(hours=1)
    ).scalar()

    if recent_posts_count >= 10:
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
        # Lost & Found
        lost_or_found=post.lost_or_found,
        item_description=post.item_description,
        location=post.location,
        reward_type=post.reward_type,
        reward_value=post.reward_value,
        # Events
        event_name=post.event_name,
        event_date=post.event_date,
        event_location=post.event_location,
        event_contact=post.event_contact,
        # News
        is_important=post.is_important,
        # Счётчики
        likes_count=0,
        comments_count=0,
        views_count=0
    )

    try:
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
        return db_post
    except Exception as e:
        if saved_images_meta:
            delete_images(saved_images_meta)
        raise e


def update_post(
    db: Session,
    post_id: int,
    post_update: schemas.PostUpdate,
    new_images_meta: Optional[List[dict]] = None,
    keep_filenames: Optional[List[str]] = None,
) -> Optional[models.Post]:
    """
    Update post (smart image merge).

    `new_images_meta` contains files already processed by the endpoint.
    """
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return None

    update_data = post_update.model_dump(exclude_unset=True)

    if "tags" in update_data:
        update_data["tags"] = sanitize_json_field(update_data["tags"])

    files_to_delete: List[str] = []

    if new_images_meta is not None or keep_filenames is not None:
        raw_old_images = json.loads(db_post.images) if db_post.images else []

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

    db_post.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except Exception:
        db.rollback()
        if new_images_meta:
            delete_images(new_images_meta)
        raise

    if files_to_delete:
        delete_images(files_to_delete)

    db.refresh(db_post)
    return db_post

def delete_post(db: Session, post_id: int) -> bool:
    """Удалить пост и его изображения"""
    db_post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not db_post:
        return False

    if db_post.images:
        try:
            images_data = json.loads(db_post.images)
            delete_images(images_data)
        except Exception as e:
            print(f"⚠️ Ошибка удаления изображений поста {post_id}: {e}")

    db.delete(db_post)
    db.commit()
    return True


# ===== ПРОСМОТРЫ =====

def increment_post_views(db: Session, post_id: int, user_id: int):
    """Увеличить счётчик просмотров поста (уникальные по юзеру)."""
    # Пропускаем рекламу (у неё свои views в AdPost)
    is_ad = db.query(models.AdPost).filter(models.AdPost.post_id == post_id).first()
    if is_ad:
        return

    has_viewed = db.query(models.PostView).filter(
        models.PostView.post_id == post_id,
        models.PostView.user_id == user_id
    ).first()

    if has_viewed:
        return

    try:
        new_view = models.PostView(post_id=post_id, user_id=user_id)
        db.add(new_view)

        db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post_id)
            .values(views_count=models.Post.views_count + 1)
        )

        db.commit()
    except Exception:
        db.rollback()


# ===== ЛАЙКИ ПОСТОВ =====

def is_post_liked_by_user(db: Session, post_id: int, user_id: int) -> bool:
    """Проверить лайкнул ли пользователь пост"""
    like = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == user_id
    ).first()
    return like is not None


def toggle_post_like(db: Session, post_id: int, user_id: int) -> dict:
    """Toggle лайка (добавить или убрать)"""
    like = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == user_id
    ).first()

    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return {"is_liked": False, "likes": 0}

    if like:
        db.delete(like)
        db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post_id)
            .values(likes_count=func.greatest(models.Post.likes_count - 1, 0))
        )
        db.commit()
        post = db.query(models.Post).filter(models.Post.id == post_id).first()
        return {"is_liked": False, "likes": post.likes_count}
    else:
        new_like = models.PostLike(user_id=user_id, post_id=post_id)
        db.add(new_like)
        db.execute(
            sa_update(models.Post)
            .where(models.Post.id == post_id)
            .values(likes_count=models.Post.likes_count + 1)
        )
        notif.check_milestone(db, post)
        db.commit()
        db.refresh(post)
        return {"is_liked": True, "likes": post.likes_count}


# ===== ОПРОСЫ (POLLS) =====

def create_poll(db: Session, post_id: int, poll_data: schemas.PollCreate) -> models.Poll:
    """Создать опрос для поста"""
    options_json = [{"text": option_text, "votes": 0} for option_text in poll_data.options]

    db_poll = models.Poll(
        post_id=post_id,
        question=poll_data.question,
        options=sanitize_json_field(options_json),
        type=poll_data.type,
        correct_option=poll_data.correct_option if poll_data.type == 'quiz' else None,
        allow_multiple=poll_data.allow_multiple,
        is_anonymous=poll_data.is_anonymous,
        closes_at=poll_data.closes_at,
        total_votes=0
    )

    db.add(db_poll)
    db.commit()
    db.refresh(db_poll)
    return db_poll


def vote_poll(db: Session, poll_id: int, user_id: int, option_indices: List[int]) -> Dict:
    """Проголосовать в опросе"""
    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise ValueError("Опрос не найден")

    if poll.closes_at and poll.closes_at < datetime.now(timezone.utc):
        raise ValueError("Опрос закрыт")

    existing_vote = db.query(models.PollVote).filter(
        models.PollVote.poll_id == poll_id,
        models.PollVote.user_id == user_id
    ).first()

    if existing_vote:
        raise ValueError("Вы уже проголосовали")

    options_data = json.loads(poll.options)
    for idx in option_indices:
        if idx < 0 or idx >= len(options_data):
            raise ValueError(f"Неверный индекс варианта: {idx}")

    if not poll.allow_multiple and len(option_indices) > 1:
        raise ValueError("Множественный выбор запрещен")

    for idx in option_indices:
        options_data[idx]['votes'] += 1

    poll.options = sanitize_json_field(options_data)

    db.execute(
        sa_update(models.Poll)
        .where(models.Poll.id == poll_id)
        .values(total_votes=models.Poll.total_votes + 1)
    )

    db_vote = models.PollVote(
        poll_id=poll_id,
        user_id=user_id,
        option_indices=sanitize_json_field(option_indices)
    )

    db.add(db_vote)
    db.commit()

    return {
        "success": True,
        "is_correct": option_indices[0] == poll.correct_option if poll.type == 'quiz' else None
    }