# ===== 📄 ФАЙЛ: bot/templates/messages.py =====
# Шаблоны всех сообщений бота. HTML parse_mode.

from keyboards.inline import (
    open_miniapp_kb, open_post_kb, open_dating_kb,
    match_kb, admin_report_kb, welcome_kb,
)


def format_welcome() -> dict:
    """Welcome message for /start."""
    text = "Добро пожаловать в CampusApp!"
    return {"text": text, "reply_markup": welcome_kb()}


def format_notification(notif_type: str, payload: dict) -> dict:
    """
    Форматирует уведомление по типу.
    Возвращает dict: {text, reply_markup} для bot.send_message()
    """
    formatters = {
        "match": _format_match,
        "dating_like": _format_dating_like,
        "comment": _format_comment,
        "comment_reply": _format_comment_reply,
        "market_contact": _format_market_contact,
        "request_response": _format_request_response,
        "milestone": _format_milestone,
        "admin_report": _format_admin_report,
    }

    formatter = formatters.get(notif_type)
    if not formatter:
        return {
            "text": f"🔔 Новое уведомление",
            "reply_markup": open_miniapp_kb(),
        }

    return formatter(payload)


def format_followup(followup_type: str, payload: dict) -> str:
    """Форматирует текст follow-up сообщения (клавиатура добавляется отдельно)"""
    if followup_type == "market_sold":
        title = _escape(payload.get("item_title", "товар"))
        return (
            f"🤝 <b>Как дела с «{title}»?</b>\n"
            "\n"
            "Удалось продать?"
        )

    elif followup_type == "request_resolved":
        title = _escape(payload.get("request_title", "запрос"))
        return (
            f"📋 <b>Как дела с запросом «{title}»?</b>\n"
            "\n"
            "Вопрос решён?"
        )

    return "🔔 У тебя есть незакрытый вопрос"


# =============================================
# Приватные форматтеры по типу уведомления
# =============================================

def _format_match(payload: dict) -> dict:
    name = _escape(payload.get("matched_name", "Кто-то"))
    age = payload.get("matched_age")
    username = payload.get("matched_username")

    text = (
        "🎉 <b>У тебя новый матч!</b>\n"
        "\n"
        "Вы понравились друг другу!\n"
        "Напиши первым — не упусти момент 😏\n"
        "\n"
        f"👤 <b>{name}</b>"
    )
    if age:
        text += f", {age} лет"
    if username:
        text += f"\n📩 @{username}"

    return {"text": text, "reply_markup": match_kb(username)}


def _format_dating_like(payload: dict) -> dict:
    text = (
        "👀 <b>Кто-то оценил твой профиль!</b>\n"
        "\n"
        "Заходи в Dating — может это взаимно?"
    )
    return {"text": text, "reply_markup": open_dating_kb()}


def _format_comment(payload: dict) -> dict:
    commenter = _escape(payload.get("commenter_name", "Кто-то"))
    post_title = _escape(payload.get("post_title", "посту"))
    comment_text = _escape(payload.get("comment_text", ""))
    post_id = payload.get("post_id")

    # Обрезаем длинный текст комментария
    if len(comment_text) > 100:
        comment_text = comment_text[:97] + "..."

    text = (
        f"💬 <b>Новый комментарий</b>\n"
        "\n"
        f"{commenter} написал к «{post_title}»:\n"
        f"<i>«{comment_text}»</i>"
    )

    kb = open_post_kb(post_id) if post_id else open_miniapp_kb()
    return {"text": text, "reply_markup": kb}


def _format_comment_reply(payload: dict) -> dict:
    replier = _escape(payload.get("replier_name", "Кто-то"))
    comment_text = _escape(payload.get("comment_text", ""))
    post_id = payload.get("post_id")

    if len(comment_text) > 100:
        comment_text = comment_text[:97] + "..."

    text = (
        f"↩️ <b>Ответ на ваш комментарий</b>\n"
        "\n"
        f"{replier}:\n"
        f"<i>«{comment_text}»</i>"
    )

    kb = open_post_kb(post_id) if post_id else open_miniapp_kb()
    return {"text": text, "reply_markup": kb}


def _format_market_contact(payload: dict) -> dict:
    buyer = _escape(payload.get("buyer_name", "Кто-то"))
    username = payload.get("buyer_username")
    title = _escape(payload.get("item_title", "товар"))

    text = (
        f"📦 <b>Интерес к твоему товару!</b>\n"
        "\n"
        f"«{title}»\n"
        "\n"
        f"Покупатель: <b>{buyer}</b>"
    )
    if username:
        text += f" (@{username})"
    text += "\nНаписал тебе в ЛС — проверь сообщения 👆"

    return {"text": text, "reply_markup": open_miniapp_kb("📦 Открыть объявление")}


def _format_request_response(payload: dict) -> dict:
    responder = _escape(payload.get("responder_name", "Кто-то"))
    username = payload.get("responder_username")
    title = _escape(payload.get("request_title", "запрос"))

    text = (
        f"🙋 <b>Отклик на твой запрос!</b>\n"
        "\n"
        f"«{title}»\n"
        "\n"
        f"Откликнулся: <b>{responder}</b>"
    )
    if username:
        text += f" (@{username})"
    text += "\nНаписал тебе в ЛС 👆"

    return {"text": text, "reply_markup": open_miniapp_kb("📋 Открыть запрос")}


def _format_milestone(payload: dict) -> dict:
    milestone = payload.get("milestone", 0)
    title = _escape(payload.get("post_title", "пост"))
    post_id = payload.get("post_id")

    # Эмодзи зависит от уровня
    if milestone >= 500:
        emoji = "🚀"
    elif milestone >= 100:
        emoji = "🔥"
    elif milestone >= 50:
        emoji = "⭐️"
    else:
        emoji = "👏"

    text = (
        f"{emoji} <b>Твой пост набрал {milestone} лайков!</b>\n"
        "\n"
        f"«{title}»"
    )

    if milestone >= 100:
        text += "\n\nПохоже, ты попал в тренды кампуса 📈"

    kb = open_post_kb(post_id) if post_id else open_miniapp_kb()
    return {"text": text, "reply_markup": kb}


def _format_admin_report(payload: dict) -> dict:
    target_type = payload.get("target_type", "контент")
    reason = _escape(payload.get("reason", "не указана"))

    # Человекочитаемые типы
    type_labels = {
        "post": "Пост",
        "comment": "Комментарий",
        "request": "Запрос",
        "market_item": "Товар",
        "dating_profile": "Профиль Dating",
    }
    readable_type = type_labels.get(target_type, target_type)

    # Человекочитаемые причины
    reason_labels = {
        "spam": "Спам",
        "abuse": "Оскорбление",
        "inappropriate": "Неприемлемый контент",
        "scam": "Мошенничество",
        "nsfw": "NSFW",
        "harassment": "Харассмент",
        "misinformation": "Дезинформация",
        "other": "Другое",
    }
    readable_reason = reason_labels.get(reason, reason)

    text = (
        f"⚠️ <b>Новый репорт</b>\n"
        "\n"
        f"📌 Тип: {readable_type}\n"
        f"📝 Причина: {readable_reason}"
    )

    return {"text": text, "reply_markup": admin_report_kb()}


# =============================================
# Ответы на follow-up кнопки
# =============================================

FOLLOWUP_ANSWERS = {
    # market_sold
    ("market_sold", "yes"): "🎉 Отлично! Объявление снято с продажи. Поздравляю!",
    ("market_sold", "no"): "👌 Понял, товар остаётся активным. Удачи с продажей!",
    ("market_sold", "in_progress"): "💬 Понял, напишу через пару дней 👍",

    # request_resolved
    ("request_resolved", "yes"): "🎉 Отлично! Запрос закрыт. Рад, что помогло!",
    ("request_resolved", "no"): "👌 Понял, запрос остаётся активным. Удачи!",
    ("request_resolved", "in_progress"): "💬 Понял, напишу через пару дней 👍",
}


def get_followup_answer_text(followup_type: str, answer: str) -> str:
    """Текст ответа юзеру после нажатия кнопки follow-up"""
    return FOLLOWUP_ANSWERS.get(
        (followup_type, answer),
        "👌 Принято!"
    )


# =============================================
# Утилиты
# =============================================

def _escape(text: str) -> str:
    """Экранирование HTML-символов для безопасного отображения"""
    if not text:
        return ""
    return (
        text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
