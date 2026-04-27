# ===== 📄 ФАЙЛ: backend/app/crud/dating.py =====
# Dating CRUD: анкеты, лента с scoring, лайки, матчи, настройки
#
# ✅ Фаза 1.4: Убраны json.loads() — JSONB-колонки возвращают нативные list/dict.
# ✅ Фаза 3.7: async/await + select() + AsyncSession
# ✅ Фаза 3.7: legacy_query_api(Model).get(id) → await db.get(Model, id)
# ✅ Фаза 5.6: create_like — один commit на лайк + матч + уведомления

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func, or_
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from app import models
from app.crud.helpers import sanitize_json_field
from app.utils import get_image_urls
from app.services import notification_service as notif


# ===== ПРОФИЛЬ =====

async def get_dating_profile(db: AsyncSession, user_id: int) -> Optional[models.DatingProfile]:
    """Получить анкету пользователя"""
    result = await db.execute(
        select(models.DatingProfile).where(models.DatingProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_dating_profile_activity(db: AsyncSession, user_id: int, is_active: bool):
    """Скрыть/показать анкету"""
    profile = await get_dating_profile(db, user_id)
    if profile:
        profile.is_active = is_active
        await db.commit()


# ===== ЛЕНТА =====

async def get_dating_feed(
    db: AsyncSession,
    current_user_id: int,
    limit: int = 10,
    offset: int = 0,
    looking_for: Optional[str] = None,
    debug: bool = False
) -> List[dict]:
    """
    Получить ленту анкет с балльным ранжированием (CampusMatch Scoring).

    Pipeline:
    1. SQL "Грубое сито" — базовые фильтры (пол, активность, не лайкнут)
    2. Python scoring — расчёт баллов совместимости для каждого кандидата
    3. Сортировка по score, выдача top-N
    """
    from app.services.dating_scoring import (
        calculate_score, get_match_reason_label,
        SCORING_POOL_SIZE, MIN_CANDIDATES_BEFORE_FALLBACK,
        INACTIVE_HARD_CUTOFF_DAYS
    )

    me_user = await db.get(models.User, current_user_id)
    if not me_user:
        return []

    me_profile = await get_dating_profile(db, current_user_id)

    # ID тех, кого я уже лайкнул/скипнул
    already_acted_ids = (
        select(models.DatingLike.whom_liked_id)
        .where(models.DatingLike.who_liked_id == current_user_id)
        .scalar_subquery()
    )

    active_cutoff = datetime.utcnow() - timedelta(days=INACTIVE_HARD_CUTOFF_DAYS)

    # === ШАГ 1: SQL "Грубое сито" ===
    def _build_base_query(filter_university: bool = True):
        q = (
            select(models.DatingProfile)
            .options(selectinload(models.DatingProfile.user))
            .join(models.User, models.DatingProfile.user_id == models.User.id)
            .where(
                models.DatingProfile.user_id != current_user_id,
                models.DatingProfile.is_active == True,
                models.User.id.notin_(already_acted_ids),
                models.User.last_active_at >= active_cutoff,
            )
        )

        # Гендерный фильтр (мой looking_for → их gender)
        if looking_for and looking_for != 'all':
            q = q.where(models.DatingProfile.gender == looking_for)

        # Двусторонний фильтр (их looking_for → мой gender)
        if me_profile and me_profile.gender:
            my_gender = me_profile.gender
            q = q.where(
                or_(
                    models.DatingProfile.looking_for == my_gender,
                    models.DatingProfile.looking_for == 'all',
                    models.DatingProfile.looking_for == 'anyone',
                )
            )

        if filter_university and me_user.university:
            q = q.where(models.User.university == me_user.university)

        return q

    # Первый проход — мой вуз
    result = await db.execute(
        _build_base_query(filter_university=True).limit(SCORING_POOL_SIZE)
    )
    candidates = result.scalars().all()

    # Fallback — если мало кандидатов, расширяем
    if len(candidates) < MIN_CANDIDATES_BEFORE_FALLBACK:
        result = await db.execute(
            _build_base_query(filter_university=False).limit(SCORING_POOL_SIZE)
        )
        candidates = result.scalars().all()

    if not candidates:
        return []

    # === ШАГ 2: Входящие лайки (кто лайкнул меня) ===
    incoming_result = await db.execute(
        select(models.DatingLike.who_liked_id).where(
            models.DatingLike.whom_liked_id == current_user_id,
            models.DatingLike.is_like == True
        )
    )
    incoming_like_ids = {row[0] for row in incoming_result.all()}

    # === ШАГ 3: Python Scoring (чистый Python, без DB) ===
    scored_candidates = []
    for profile in candidates:
        user = profile.user  # ✅ selectinload загрузил user
        result_score = calculate_score(
            me_user=me_user,
            me_profile=me_profile,
            candidate_user=user,
            candidate_profile=profile,
            incoming_like_ids=incoming_like_ids
        )

        photos_raw = profile.photos
        photos = get_image_urls(photos_raw) if photos_raw else []
        if not photos and user.avatar:
            photos = [{"url": user.avatar, "w": 500, "h": 500}]

        interests = user.interests or []
        goals = profile.goals or []

        candidate_data = {
            "id": user.id,
            "name": user.name,
            "age": user.age,
            "bio": profile.bio or user.bio,
            "university": user.university,
            "institute": user.institute,
            "course": user.course,
            "photos": photos,
            "goals": goals,
            "interests": interests,
            "looking_for": profile.looking_for,
            "match_reason": get_match_reason_label(result_score["match_reason"]),
            "common_interests": result_score["breakdown"].get("common_interests", []),
            "common_goals": result_score["breakdown"].get("common_goals", []),
        }

        if debug:
            candidate_data["_debug_score"] = result_score["breakdown"]

        candidate_data["_sort_score"] = result_score["score"]
        scored_candidates.append(candidate_data)

    # === ШАГ 4: Сортировка и пагинация ===
    scored_candidates.sort(key=lambda x: x["_sort_score"], reverse=True)
    page = scored_candidates[offset:offset + limit]

    for item in page:
        if not debug:
            item.pop("_sort_score", None)
        else:
            item["_debug_score"]["final_score"] = item.pop("_sort_score", 0)

    return page


# ===== ЛАЙКИ И МАТЧИ =====

async def create_like(db: AsyncSession, liker_id: int, liked_id: int) -> dict:
    """✅ Фаза 5.6: один await db.commit() на лайк + матч + уведомления"""
    if liker_id == liked_id:
        return {"success": False, "error": "Нельзя лайкнуть себя"}

    existing_result = await db.execute(
        select(models.DatingLike).where(
            models.DatingLike.who_liked_id == liker_id,
            models.DatingLike.whom_liked_id == liked_id
        )
    )
    if existing_result.scalar_one_or_none():
        return {"success": True, "is_match": False, "already_liked": True}

    new_like = models.DatingLike(who_liked_id=liker_id, whom_liked_id=liked_id, is_like=True)
    db.add(new_like)

    try:
        await db.flush()  # получаем ID, но НЕ коммитим
    except IntegrityError:
        await db.rollback()
        return {"success": True, "is_match": False, "already_liked": True}

    # Уведомление о лайке
    await notif.notify_dating_like(db, liked_id)

    # Проверяем обратный лайк
    reverse_result = await db.execute(
        select(models.DatingLike).where(
            models.DatingLike.who_liked_id == liked_id,
            models.DatingLike.whom_liked_id == liker_id,
            models.DatingLike.is_like == True
        )
    )
    reverse_like = reverse_result.scalar_one_or_none()

    is_match = False
    match_obj = None
    matched_user = None

    if reverse_like:
        is_match = True
        user_a = min(liker_id, liked_id)
        user_b = max(liker_id, liked_id)

        existing_match_result = await db.execute(
            select(models.Match).where(
                models.Match.user_a_id == user_a,
                models.Match.user_b_id == user_b
            )
        )

        if not existing_match_result.scalar_one_or_none():
            match_obj = models.Match(user_a_id=user_a, user_b_id=user_b)
            db.add(match_obj)

            liker_user = await db.get(models.User, liker_id)
            liked_user = await db.get(models.User, liked_id)
            if liker_user and liked_user:
                await notif.notify_match(db, liker_user, liked_user)

        matched_user = await db.get(models.User, liked_id)

    # Единый коммит: лайк + (матч + уведомления)
    await db.commit()

    if match_obj:
        await db.refresh(match_obj)

    return {
        "success": True,
        "is_match": is_match,
        "match_id": match_obj.id if match_obj else None,
        "matched_user": matched_user
    }


async def create_dislike(db: AsyncSession, disliker_id: int, disliked_id: int) -> dict:
    if disliker_id == disliked_id:
        return {"success": False, "error": "Нельзя дизлайкнуть себя"}

    existing_result = await db.execute(
        select(models.DatingLike).where(
            models.DatingLike.who_liked_id == disliker_id,
            models.DatingLike.whom_liked_id == disliked_id
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.is_like = False
        await db.commit()
        return {"success": True, "updated": True}

    new_dislike = models.DatingLike(
        who_liked_id=disliker_id,
        whom_liked_id=disliked_id,
        is_like=False
    )
    db.add(new_dislike)
    await db.commit()

    return {"success": True, "updated": False}


async def get_who_liked_me(db: AsyncSession, user_id: int, limit: int = 20, offset: int = 0) -> List[models.User]:
    my_likes_subq = (
        select(models.DatingLike.whom_liked_id)
        .where(models.DatingLike.who_liked_id == user_id)
        .scalar_subquery()
    )

    result = await db.execute(
        select(models.User)
        .join(models.DatingLike, models.DatingLike.who_liked_id == models.User.id)
        .where(
            models.DatingLike.whom_liked_id == user_id,
            models.DatingLike.is_like == True,
            models.User.id.notin_(my_likes_subq)
        )
        .order_by(models.DatingLike.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


# ===== СТАТИСТИКА И НАСТРОЙКИ =====

async def get_dating_stats(db: AsyncSession, user_id: int) -> dict:
    my_likes_subq = (
        select(models.DatingLike.whom_liked_id)
        .where(models.DatingLike.who_liked_id == user_id)
        .scalar_subquery()
    )

    likes_count = await db.scalar(
        select(func.count(models.DatingLike.id)).where(
            models.DatingLike.whom_liked_id == user_id,
            models.DatingLike.is_like == True,
            models.DatingLike.who_liked_id.notin_(my_likes_subq)
        )
    )

    matches_count = await db.scalar(
        select(func.count(models.Match.id)).where(
            or_(models.Match.user_a_id == user_id, models.Match.user_b_id == user_id)
        )
    )

    return {"likes_count": likes_count or 0, "matches_count": matches_count or 0}


async def update_dating_settings(db: AsyncSession, user_id: int, settings: dict) -> Optional[models.User]:
    # ✅ selectinload для dating_profile — нужен для user.dating_profile ниже
    result = await db.execute(
        select(models.User)
        .options(selectinload(models.User.dating_profile))
        .where(models.User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return None

    if 'show_in_dating' in settings:
        is_visible = settings['show_in_dating']
        user.show_in_dating = is_visible
        if user.dating_profile:
            user.dating_profile.is_active = is_visible

    if 'hide_course_group' in settings:
        user.hide_course_group = settings['hide_course_group']

    if 'interests' in settings:
        val = settings['interests']
        if isinstance(val, list):
            user.interests = val
        else:
            user.interests = val

    await db.commit()
    await db.refresh(user)
    return user
