# ===== FILE: backend/app/serialization.py =====
#
# Сериализаторы с редакцией приватных данных. Используется вместо прямых
# UserShort.from_orm/UserShort(...) когда отдаём чужого пользователя в API.
#
# Правило раскрытия Telegram-контактов (telegram_id, telegram_username):
#   1. user — это сам viewer (передан viewer_id == user.id), ИЛИ
#   2. force_reveal_contact=True (взаимный Match в дейтинге, модераторский доступ), ИЛИ
#   3. user.show_profile && user.show_telegram_id (юзер сам разрешил публичный контакт).
# Иначе оба поля → None.
#
# Опирается на тот же принцип, что _public_telegram_contact в
# backend/app/services/notification_service.py.

from typing import Optional

from app import models, schemas


def public_user_short(
    user: Optional[models.User],
    *,
    viewer_id: Optional[int] = None,
    force_reveal_contact: bool = False,
) -> Optional[schemas.UserShort]:
    if user is None:
        return None

    is_self = viewer_id is not None and getattr(user, "id", None) == viewer_id
    show_contact = (
        is_self
        or force_reveal_contact
        or (
            bool(getattr(user, "show_profile", False))
            and bool(getattr(user, "show_telegram_id", False))
        )
    )

    return schemas.UserShort(
        id=getattr(user, "id", None),
        telegram_id=user.telegram_id if show_contact else None,
        telegram_username=user.telegram_username if show_contact else None,
        username=getattr(user, "username", None),
        name=getattr(user, "name", None) or "",
        avatar=getattr(user, "avatar", None),
        campus_id=getattr(user, "campus_id", None),
        university=getattr(user, "university", None),
        institute=getattr(user, "institute", None),
        course=getattr(user, "course", None),
        city=getattr(user, "city", None),
        role=getattr(user, "role", "user") or "user",
        show_profile=bool(getattr(user, "show_profile", True)),
        show_telegram_id=bool(getattr(user, "show_telegram_id", False)),
    )
