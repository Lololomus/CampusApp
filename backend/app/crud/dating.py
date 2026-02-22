# ===== 📄 ФАЙЛ: backend/app/crud/dating.py =====
# Dating CRUD: анкеты, лента с scoring, лайки, матчи, настройки
#
# ✅ Фаза 1.4: Убраны json.loads() — JSONB-колонки возвращают нативные list/dict.

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from app import models
from app.crud.helpers import sanitize_json_field
from app.utils import get_image_urls
from app.services import notification_service as notif


# ===== ПРОФИЛЬ =====

def get_dating_profile(db: Session, user_id: int) -> Optional[models.DatingProfile]:
    """Получить анкету пользователя"""
    return db.query(models.DatingProfile).filter(models.DatingProfile.user_id == user_id).first()


def update_dating_profile_activity(db: Session, user_id: int, is_active: bool):
    """Скрыть/показать анкету"""
    profile = get_dating_profile(db, user_id)
    if profile:
        profile.is_active = is_active
        db.commit()


# ===== ЛЕНТА =====

def get_dating_feed(
    db: Session,
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

    me_user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if not me_user:
        return []
    me_profile = db.query(models.DatingProfile).filter(
        models.DatingProfile.user_id == current_user_id
    ).first()

    # ID тех, кого я уже лайкнул/скипнул
    already_acted_ids = db.query(models.DatingLike.whom_liked_id).filter(
        models.DatingLike.who_liked_id == current_user_id
    ).subquery()

    active_cutoff = datetime.now(timezone.utc) - timedelta(days=INACTIVE_HARD_CUTOFF_DAYS)

    # === ШАГ 1: SQL "Грубое сито" ===
    def _build_base_query(filter_university: bool = True):
        q = db.query(models.DatingProfile).join(
            models.User, models.DatingProfile.user_id == models.User.id
        ).filter(
            models.DatingProfile.user_id != current_user_id,
            models.DatingProfile.is_active == True,
            models.User.id.notin_(already_acted_ids),
            models.User.last_active_at >= active_cutoff,
        )

        # Гендерный фильтр (мой looking_for → их gender)
        if looking_for and looking_for != 'all':
            q = q.filter(models.DatingProfile.gender == looking_for)

        # Двусторонний фильтр (их looking_for → мой gender)
        if me_profile and me_profile.gender:
            my_gender = me_profile.gender
            q = q.filter(
                or_(
                    models.DatingProfile.looking_for == my_gender,
                    models.DatingProfile.looking_for == 'all',
                    models.DatingProfile.looking_for == 'anyone',
                )
            )

        if filter_university and me_user.university:
            q = q.filter(models.User.university == me_user.university)

        return q

    # Первый проход — мой вуз
    candidates = _build_base_query(filter_university=True).limit(SCORING_POOL_SIZE).all()

    # Fallback — если мало кандидатов, расширяем
    if len(candidates) < MIN_CANDIDATES_BEFORE_FALLBACK:
        candidates = _build_base_query(filter_university=False).limit(SCORING_POOL_SIZE).all()

    if not candidates:
        return []

    # === ШАГ 2: Входящие лайки (кто лайкнул меня) ===
    incoming_likes_rows = db.query(models.DatingLike.who_liked_id).filter(
        models.DatingLike.whom_liked_id == current_user_id,
        models.DatingLike.is_like == True
    ).all()
    incoming_like_ids = {row[0] for row in incoming_likes_rows}

    # === ШАГ 3: Python Scoring ===
    scored_candidates = []
    for profile in candidates:
        user = profile.user
        result = calculate_score(
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

        # ✅ JSONB: user.interests и profile.goals уже list
        interests = user.interests or []
        goals = profile.goals or []

        candidate_data = {
            "id": user.id,
            "telegram_id": user.telegram_id,
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
            "match_reason": get_match_reason_label(result["match_reason"]),
            "common_interests": result["breakdown"].get("common_interests", []),
        }

        if debug:
            candidate_data["_debug_score"] = result["breakdown"]

        candidate_data["_sort_score"] = result["score"]
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

def create_like(db: Session, liker_id: int, liked_id: int) -> dict:
    if liker_id == liked_id:
        return {"success": False, "error": "Нельзя лайкнуть себя"}

    existing = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == liker_id,
        models.DatingLike.whom_liked_id == liked_id
    ).first()

    if existing:
        return {"success": True, "is_match": False, "already_liked": True}

    new_like = models.DatingLike(who_liked_id=liker_id, whom_liked_id=liked_id, is_like=True)
    db.add(new_like)
    try:
        notif.notify_dating_like(db, liked_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"success": True, "is_match": False, "already_liked": True}

    reverse_like = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == liked_id,
        models.DatingLike.whom_liked_id == liker_id,
        models.DatingLike.is_like == True
    ).first()

    is_match = False
    match_obj = None
    matched_user = None

    if reverse_like:
        is_match = True
        user_a = min(liker_id, liked_id)
        user_b = max(liker_id, liked_id)

        existing_match = db.query(models.Match).filter(
            models.Match.user_a_id == user_a,
            models.Match.user_b_id == user_b
        ).first()

        if not existing_match:
            match_obj = models.Match(user_a_id=user_a, user_b_id=user_b)
            db.add(match_obj)

            liker_user = db.query(models.User).get(liker_id)
            liked_user = db.query(models.User).get(liked_id)
            if liker_user and liked_user:
                notif.notify_match(db, liker_user, liked_user)

            db.commit()
            db.refresh(match_obj)

        matched_user = db.query(models.User).filter(models.User.id == liked_id).first()

    return {
        "success": True,
        "is_match": is_match,
        "match_id": match_obj.id if match_obj else None,
        "matched_user": matched_user
    }


def create_dislike(db: Session, disliker_id: int, disliked_id: int) -> dict:
    if disliker_id == disliked_id:
        return {"success": False, "error": "Нельзя дизлайкнуть себя"}

    existing = db.query(models.DatingLike).filter(
        models.DatingLike.who_liked_id == disliker_id,
        models.DatingLike.whom_liked_id == disliked_id
    ).first()

    if existing:
        existing.is_like = False
        db.commit()
        return {"success": True, "updated": True}

    new_dislike = models.DatingLike(
        who_liked_id=disliker_id,
        whom_liked_id=disliked_id,
        is_like=False
    )
    db.add(new_dislike)
    db.commit()

    return {"success": True, "updated": False}


def get_who_liked_me(db: Session, user_id: int, limit: int = 20, offset: int = 0) -> List[models.User]:
    my_likes = db.query(models.DatingLike.whom_liked_id).filter(
        models.DatingLike.who_liked_id == user_id
    ).subquery()

    users = db.query(models.User).join(
        models.DatingLike, models.DatingLike.who_liked_id == models.User.id
    ).filter(
        models.DatingLike.whom_liked_id == user_id,
        models.DatingLike.is_like == True,
        models.User.id.notin_(my_likes)
    ).order_by(
        models.DatingLike.created_at.desc()
    ).offset(offset).limit(limit).all()

    return users


# ===== СТАТИСТИКА И НАСТРОЙКИ =====

def get_dating_stats(db: Session, user_id: int) -> dict:
    my_likes = db.query(models.DatingLike.whom_liked_id).filter(
        models.DatingLike.who_liked_id == user_id
    ).subquery()

    likes_count = db.query(func.count(models.DatingLike.id)).filter(
        models.DatingLike.whom_liked_id == user_id,
        models.DatingLike.is_like == True,
        models.DatingLike.who_liked_id.notin_(my_likes)
    ).scalar()

    matches_count = db.query(func.count(models.Match.id)).filter(
        or_(models.Match.user_a_id == user_id, models.Match.user_b_id == user_id)
    ).scalar()

    return {"likes_count": likes_count, "matches_count": matches_count}


def update_dating_settings(db: Session, user_id: int, settings: dict) -> Optional[models.User]:
    user = db.query(models.User).filter(models.User.id == user_id).first()
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
            user.interests = val               # ✅ JSONB: list напрямую
        else:
            user.interests = val

    db.commit()
    db.refresh(user)
    return user