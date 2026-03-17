# ===== FILE: bot/keyboards/inline.py =====

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from config import MINIAPP_URL


def open_miniapp_kb(text: str = "📱 Открыть CampusApp") -> InlineKeyboardMarkup:
    """Кнопка открытия mini app."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=text, web_app=WebAppInfo(url=MINIAPP_URL))]
        ]
    )


def open_post_kb(post_id: int) -> InlineKeyboardMarkup:
    """Кнопка открытия конкретного поста."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔗 Открыть пост",
                    web_app=WebAppInfo(url=f"{MINIAPP_URL}?post={post_id}"),
                )
            ]
        ]
    )


def open_dating_kb() -> InlineKeyboardMarkup:
    """Кнопка открытия Dating."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="💘 Открыть Dating",
                    web_app=WebAppInfo(url=f"{MINIAPP_URL}?tab=dating"),
                )
            ]
        ]
    )


def match_kb(username: str | None = None) -> InlineKeyboardMarkup:
    """Кнопки при мэтче: написать + открыть профиль в приложении."""
    buttons = []
    if username:
        buttons.append(
            [InlineKeyboardButton(text="💬 Написать", url=f"https://t.me/{username}")]
        )

    buttons.append(
        [
            InlineKeyboardButton(
                text="❤️ Открыть профиль",
                web_app=WebAppInfo(url=f"{MINIAPP_URL}?tab=dating"),
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def followup_market_kb(followup_id: int) -> InlineKeyboardMarkup:
    """Кнопки follow-up: продал товар?"""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Да, продал",
                    callback_data=f"fu:{followup_id}:yes",
                ),
                InlineKeyboardButton(
                    text="❌ Нет",
                    callback_data=f"fu:{followup_id}:no",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="💬 Общаемся",
                    callback_data=f"fu:{followup_id}:in_progress",
                )
            ],
        ]
    )


def followup_request_kb(followup_id: int) -> InlineKeyboardMarkup:
    """Кнопки follow-up: помогли с запросом?"""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Да, помогли",
                    callback_data=f"fu:{followup_id}:yes",
                ),
                InlineKeyboardButton(
                    text="❌ Нет, еще ищу",
                    callback_data=f"fu:{followup_id}:no",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="💬 В процессе",
                    callback_data=f"fu:{followup_id}:in_progress",
                )
            ],
        ]
    )


def admin_report_kb() -> InlineKeyboardMarkup:
    """Кнопка открытия админки для модераторов."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔧 Открыть админку",
                    web_app=WebAppInfo(url=f"{MINIAPP_URL}?tab=admin"),
                )
            ]
        ]
    )


def review_stars_kb(item_id: int, seller_id: int) -> InlineKeyboardMarkup:
    """Клавиатура оценки продавца: звёзды 1–5 + Пропустить."""
    stars = [
        InlineKeyboardButton(text=f"{i}⭐", callback_data=f"rv:{item_id}:{seller_id}:{i}")
        for i in range(1, 6)
    ]
    skip = InlineKeyboardButton(text="Пропустить", callback_data=f"rv_skip:{item_id}")
    return InlineKeyboardMarkup(inline_keyboard=[stars, [skip]])


def review_text_skip_kb(review_id: int) -> InlineKeyboardMarkup:
    """Кнопка пропустить добавление текста отзыва."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Пропустить", callback_data=f"rv_text_skip:{review_id}")
    ]])


def welcome_kb() -> InlineKeyboardMarkup:
    """Кнопка в welcome-сообщении."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Запустить приложение",
                    web_app=WebAppInfo(url=MINIAPP_URL),
                )
            ]
        ]
    )
