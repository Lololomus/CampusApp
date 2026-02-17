# ===== 📄 ФАЙЛ: backend/app/services/dating_scoring.py =====
# Система скоринга для дейтинг-ленты CampusMatch
# Все веса и настройки — здесь. Меняй числа → перезапусти сервер → готово.

import json
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any


# ========================================
# 🎛 ВЕСА (КРУТИЛКИ) — меняй значения здесь
# ========================================

# --- Социальная близость ---
WEIGHT_SAME_UNIVERSITY = 50       # Тот же вуз
WEIGHT_SAME_CAMPUS = 15           # Тот же кампус (campus_id совпал)
WEIGHT_SAME_INSTITUTE = 20        # Тот же факультет/институт
WEIGHT_SAME_COURSE = 10           # Тот же курс

# --- Интересы ---
WEIGHT_PER_INTEREST = 7           # За каждый общий интерес
WEIGHT_INTERESTS_MAX = 35         # Потолок баллов за интересы

# --- Цели ---
WEIGHT_GOAL_MATCH = 25            # Совпадение целей (оба ищут "Отношения")
WEIGHT_GOAL_CONFLICT = -10        # Конфликт целей ("Общение" vs "Отношения")

# --- Контекстные бонусы ---
WEIGHT_INCOMING_LIKE = 30         # Кандидат уже лайкнул тебя
WEIGHT_FRESH_24H = 40             # Новый профиль (0-24ч)
WEIGHT_FRESH_48H = 20             # Новый профиль (24-48ч)
WEIGHT_FRESH_72H = 10             # Новый профиль (48-72ч)

# --- Штрафы: Возраст ---
AGE_COMFORT_DIVISOR = 7           # Зона комфорта = max(2, age / divisor)
AGE_COMFORT_MIN = 2               # Минимальная зона комфорта (лет)
AGE_PENALTY_MILD = -5             # Штраф за год (1-3 года за зоной)
AGE_PENALTY_MILD_RANGE = 3        # Диапазон мягкого штрафа (лет)
AGE_PENALTY_HARSH = -15           # Штраф за год (3+ лет за зоной)

# --- Штрафы: Активность ---
PENALTY_INACTIVE_3D = -10         # Не был онлайн >3 дней
PENALTY_INACTIVE_7D = -50         # Не был онлайн >7 дней
INACTIVE_HARD_CUTOFF_DAYS = 30    # Полное исключение из выдачи (SQL)

# --- Полнота профиля (множитель) ---
COMPLETENESS_NO_PHOTO = 0.3       # Нет фото
COMPLETENESS_NO_BIO = 0.7         # Есть фото, нет bio
COMPLETENESS_FULL = 1.0           # Всё заполнено

# --- Случайность ---
JITTER_RANGE = 10                 # ±10 баллов

# --- Fallback ---
MIN_CANDIDATES_BEFORE_FALLBACK = 5  # Если кандидатов < 5, убираем фильтр вуза
SCORING_POOL_SIZE = 200             # Сколько кандидатов забирать из SQL для скоринга


# ========================================
# 📊 ФУНКЦИИ СКОРИНГА
# ========================================

def _parse_json_safe(value: Any) -> list:
    """Безопасный парсинг JSON-строки в список"""
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            result = json.loads(value)
            return result if isinstance(result, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    return []


def calculate_age_penalty(my_age: int, their_age: int) -> int:
    """
    Динамический штраф за разницу в возрасте.
    Зона комфорта расширяется для старших пользователей.
    """
    if not my_age or not their_age:
        return 0

    comfort_zone = max(AGE_COMFORT_MIN, my_age / AGE_COMFORT_DIVISOR)
    diff = abs(my_age - their_age)

    if diff <= comfort_zone:
        return 0

    over = diff - comfort_zone
    if over <= AGE_PENALTY_MILD_RANGE:
        return int(over * AGE_PENALTY_MILD)
    else:
        mild_part = AGE_PENALTY_MILD_RANGE * AGE_PENALTY_MILD
        harsh_part = (over - AGE_PENALTY_MILD_RANGE) * AGE_PENALTY_HARSH
        return int(mild_part + harsh_part)


def calculate_profile_completeness(candidate_profile, candidate_user) -> float:
    """
    Множитель полноты профиля.
    Мотивирует заполнять анкету.
    """
    photos = _parse_json_safe(candidate_profile.photos)
    has_photos = len(photos) > 0
    has_bio = bool(candidate_profile.bio and len(candidate_profile.bio.strip()) >= 10)

    if not has_photos:
        return COMPLETENESS_NO_PHOTO
    if not has_bio:
        return COMPLETENESS_NO_BIO
    return COMPLETENESS_FULL


def calculate_fresh_boost(profile_created_at: Optional[datetime]) -> int:
    """Бонус для новых профилей (затухающий)"""
    if not profile_created_at:
        return 0

    now = datetime.now(timezone.utc)
    # Приводим к aware datetime если naive
    if profile_created_at.tzinfo is None:
        profile_created_at = profile_created_at.replace(tzinfo=timezone.utc)

    age_hours = (now - profile_created_at).total_seconds() / 3600

    if age_hours <= 24:
        return WEIGHT_FRESH_24H
    elif age_hours <= 48:
        return WEIGHT_FRESH_48H
    elif age_hours <= 72:
        return WEIGHT_FRESH_72H
    return 0


def calculate_activity_penalty(last_active_at: Optional[datetime]) -> int:
    """Штраф за неактивность"""
    if not last_active_at:
        return PENALTY_INACTIVE_7D

    now = datetime.now(timezone.utc)
    if last_active_at.tzinfo is None:
        last_active_at = last_active_at.replace(tzinfo=timezone.utc)

    days_inactive = (now - last_active_at).total_seconds() / 86400

    if days_inactive <= 1:
        return 0
    elif days_inactive <= 3:
        return 0
    elif days_inactive <= 7:
        return PENALTY_INACTIVE_3D
    else:
        return PENALTY_INACTIVE_7D


def calculate_score(
    me_user,
    me_profile,
    candidate_user,
    candidate_profile,
    incoming_like_ids: set
) -> Dict:
    """
    Рассчитать score совместимости для одного кандидата.
    Возвращает dict с итоговым баллом и breakdown для дебага.
    """
    breakdown = {}

    # --- Социальная близость ---
    uni_score = 0
    if me_user.university and candidate_user.university:
        if me_user.university.strip().lower() == candidate_user.university.strip().lower():
            uni_score += WEIGHT_SAME_UNIVERSITY

            # Бонус за кампус
            if me_user.campus_id and candidate_user.campus_id:
                if me_user.campus_id == candidate_user.campus_id:
                    uni_score += WEIGHT_SAME_CAMPUS

            # Бонус за факультет
            if me_user.institute and candidate_user.institute:
                if me_user.institute.strip().lower() == candidate_user.institute.strip().lower():
                    uni_score += WEIGHT_SAME_INSTITUTE

            # Бонус за курс
            if me_user.course and candidate_user.course:
                if me_user.course == candidate_user.course:
                    uni_score += WEIGHT_SAME_COURSE

    breakdown["university"] = uni_score

    # --- Интересы ---
    my_interests = set(i.lower().strip() for i in _parse_json_safe(me_user.interests))
    their_interests = set(i.lower().strip() for i in _parse_json_safe(candidate_user.interests))
    common_interests = my_interests & their_interests
    interest_score = min(len(common_interests) * WEIGHT_PER_INTEREST, WEIGHT_INTERESTS_MAX)
    breakdown["interests"] = interest_score
    breakdown["common_interests"] = list(common_interests)

    # --- Цели ---
    my_goals = set(g.lower().strip() for g in (_parse_json_safe(me_profile.goals) if me_profile else []))
    their_goals = set(g.lower().strip() for g in _parse_json_safe(candidate_profile.goals))
    goal_score = 0
    if my_goals and their_goals:
        if my_goals & their_goals:
            goal_score = WEIGHT_GOAL_MATCH
        else:
            goal_score = WEIGHT_GOAL_CONFLICT
    breakdown["goals"] = goal_score

    # --- Входящий лайк ---
    like_score = WEIGHT_INCOMING_LIKE if candidate_user.id in incoming_like_ids else 0
    breakdown["incoming_like"] = like_score

    # --- Новичок ---
    fresh_score = calculate_fresh_boost(candidate_profile.created_at)
    breakdown["fresh"] = fresh_score

    # --- Возраст ---
    age_score = calculate_age_penalty(me_user.age, candidate_user.age)
    breakdown["age"] = age_score

    # --- Активность ---
    activity_score = calculate_activity_penalty(candidate_user.last_active_at)
    breakdown["activity"] = activity_score

    # --- Полнота профиля ---
    completeness = calculate_profile_completeness(candidate_profile, candidate_user)
    breakdown["completeness"] = completeness

    # --- Jitter ---
    jitter = random.randint(-JITTER_RANGE, JITTER_RANGE)
    breakdown["jitter"] = jitter

    # --- Итог ---
    raw_score = (
        uni_score
        + interest_score
        + goal_score
        + like_score
        + fresh_score
        + age_score
        + activity_score
        + jitter
    )
    final_score = int(raw_score * completeness)
    breakdown["raw_score"] = raw_score
    breakdown["final_score"] = final_score

    return {
        "score": final_score,
        "breakdown": breakdown,
        "match_reason": _determine_match_reason(breakdown, uni_score, common_interests, goal_score)
    }


def _determine_match_reason(
    breakdown: dict,
    uni_score: int,
    common_interests: set,
    goal_score: int
) -> Optional[str]:
    """
    Выбрать одну самую релевантную причину показа.
    Иерархия: факультет > вуз > интересы > цели
    """
    # Факультет/институт (самое точное совпадение)
    if uni_score >= (WEIGHT_SAME_UNIVERSITY + WEIGHT_SAME_INSTITUTE):
        return "faculty"

    # Вуз
    if uni_score >= WEIGHT_SAME_UNIVERSITY:
        return "university"

    # Интересы (3+ общих)
    interest_count = len(common_interests)
    if interest_count >= 3:
        return f"interests_{interest_count}"

    # Интересы (1-2 общих)
    if interest_count >= 1:
        return f"interests_{interest_count}"

    # Цели совпали
    if goal_score > 0:
        return "goals"

    return None


# ========================================
# 🏷 ЛОКАЛИЗАЦИЯ match_reason → текст для UI
# ========================================

MATCH_REASON_LABELS = {
    "faculty": "Учитесь на одном факультете",
    "university": "Из твоего вуза",
    "goals": "Ищет то же, что и ты",
}


def get_match_reason_label(reason: Optional[str]) -> Optional[str]:
    """Преобразовать reason код в человекочитаемый текст"""
    if not reason:
        return None

    if reason in MATCH_REASON_LABELS:
        return MATCH_REASON_LABELS[reason]

    if reason.startswith("interests_"):
        try:
            count = int(reason.split("_")[1])
            if count == 1:
                return "1 общий интерес"
            elif count in (2, 3, 4):
                return f"{count} общих интереса"
            else:
                return f"{count} общих интересов"
        except (ValueError, IndexError):
            return "Общие интересы"

    return None