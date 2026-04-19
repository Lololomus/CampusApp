# ===== FILE: bot/templates/messages.py =====
# Шаблоны сообщений бота. parse_mode=HTML.

import re

from keyboards.inline import (
    admin_report_kb,
    match_kb,
    open_dating_kb,
    open_market_deal_kb,
    open_miniapp_kb,
    open_post_kb,
    welcome_kb,
)


TELEGRAM_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{5,32}$")
EMPTY_USERNAME_VALUES = {"none", "null", "undefined"}


def _clean_username(value) -> str | None:
    username = str(value or "").lstrip("@").strip()
    if username.lower() in EMPTY_USERNAME_VALUES:
        return None
    if not TELEGRAM_USERNAME_RE.match(username):
        return None
    return username


def format_welcome(name: str = "") -> dict:
    """Welcome message for /start."""
    greeting = f"Привет, {name}! 👋" if name else "Привет! 👋"
    text = (
        f"{greeting}\n"
        "\n"
        "Добро пожаловать в <b>CampusApp</b> — соцсеть твоего кампуса.\n"
        "\n"
        "📰  Лента постов и событий\n"
        "💘  Dating для студентов\n"
        "🛍  Маркет и услуги\n"
        "\n"
        "Я буду присылать уведомления о мэтчах, комментариях и откликах — прямо сюда."
    )
    return {"text": text, "reply_markup": welcome_kb()}


def format_notification(notif_type: str, payload: dict) -> dict:
    """
    Форматирует уведомление по типу.
    Возвращает dict: {text, reply_markup}.
    """
    formatters = {
        "match": _format_match,
        "dating_like": _format_dating_like,
        "comment": _format_comment,
        "comment_reply": _format_comment_reply,
        "poll_vote": _format_poll_vote,
        "market_contact": _format_market_contact,
        "market_deal_update": _format_market_deal_update,
        "request_response": _format_request_response,
        "contact_request_decision": _format_contact_request_decision,
        "milestone": _format_milestone,
        "admin_report": _format_admin_report,
    }

    formatter = formatters.get(notif_type)
    if not formatter:
        return {
            "text": "🔔 Новое уведомление",
            "reply_markup": open_miniapp_kb(),
        }

    return formatter(payload)


def format_followup(followup_type: str, payload: dict) -> str:
    """Форматирует текст follow-up сообщения (клавиатура добавляется отдельно)."""
    if followup_type == "market_sold":
        title = _escape(payload.get("item_title", "товар"))
        buyer = _escape(payload.get("buyer_name", "покупатель"))
        buyer_username = _clean_username(payload.get("buyer_username"))
        buyer_label = f"{buyer} (@{_escape(buyer_username)})" if buyer_username else buyer
        item_type = payload.get("item_type", "product")
        question = "Услуга оказана?" if item_type == "service" else "Удалось продать?"
        return (
            f"🤝 <b>Пользователь {buyer_label} хотел купить «{title}».</b>\n"
            "\n"
            f"{question}"
        )

    if followup_type == "request_resolved":
        title = _escape(payload.get("request_title", "запрос"))
        return (
            f"📋 <b>Как дела с запросом «{title}»?</b>\n"
            "\n"
            "Вопрос решен?"
        )

    if followup_type == "review_request":
        seller = _escape(payload.get("seller_name", "продавца"))
        title = _escape(payload.get("item_title", "товар"))
        return (
            f"⭐ <b>Оцени продавца!</b>\n"
            "\n"
            f"Сделка по «{title}» завершена.\n"
            f"Как прошло с <b>{seller}</b>?"
        )

    return "🔔 У тебя есть незакрытый вопрос"


def _format_match(payload: dict) -> dict:
    name = _escape(payload.get("matched_name", "Кто-то"))
    age = payload.get("matched_age")
    username = _clean_username(payload.get("matched_username"))

    text = (
        "🎉 <b>У тебя новый мэтч!</b>\n"
        "\n"
        "Вы понравились друг другу.\n"
        "Напиши первым, не упусти момент 😏\n"
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
        "Зайди в Dating — может, это взаимно?"
    )
    return {"text": text, "reply_markup": open_dating_kb()}


def _format_comment(payload: dict) -> dict:
    commenter = _escape(payload.get("commenter_name", "Кто-то"))
    post_title = _escape(payload.get("post_title", "посту"))
    comment_text = _escape(payload.get("comment_text", ""))
    post_id = payload.get("post_id")

    if len(comment_text) > 100:
        comment_text = comment_text[:97] + "..."

    text = (
        "💬 <b>Новый комментарий</b>\n"
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
        "↩️ <b>Ответ на ваш комментарий</b>\n"
        "\n"
        f"{replier}:\n"
        f"<i>«{comment_text}»</i>"
    )

    kb = open_post_kb(post_id) if post_id else open_miniapp_kb()
    return {"text": text, "reply_markup": kb}


def _format_poll_vote(payload: dict) -> dict:
    poll_type = payload.get("poll_type")
    entity_label = "викторине" if poll_type == "quiz" else "опросе"
    question = _escape(payload.get("poll_question", ""))
    post_id = payload.get("post_id")
    vote_count = int(payload.get("vote_count") or 0)

    if payload.get("is_anonymous"):
        text = (
            "📊 <b>Новые голоса в твоем опросе</b>\n"
            "\n"
            f"В твоем {entity_label} уже {vote_count} {_vote_word(vote_count)}."
        )
    else:
        voters = payload.get("voters") or []
        names = [_escape(item.get("name", "")) for item in voters[:2] if item.get("name")]
        extra_count = max(vote_count - len(names), 0)

        if len(names) >= 2:
            headline = f"<b>{names[0]}</b> и <b>{names[1]}</b> проголосовали в твоем {entity_label}"
        elif len(names) == 1:
            headline = f"<b>{names[0]}</b> проголосовал(а) в твоем {entity_label}"
        else:
            headline = f"В твоем {entity_label} уже {vote_count} {_vote_word(vote_count)}"

        text = f"📊 <b>Новый отклик на твой опрос</b>\n\n{headline}"
        if extra_count > 0:
            text += f"\nИ ещё {extra_count}"

    if question:
        text += f"\n\n«{question}»"

    kb = open_post_kb(post_id) if post_id else open_miniapp_kb()
    return {"text": text, "reply_markup": kb}


def _format_market_contact(payload: dict) -> dict:
    buyer = _escape(payload.get("buyer_name", "Кто-то"))
    username = _clean_username(payload.get("buyer_username"))
    title = _escape(payload.get("item_title", "товар"))
    item_type = payload.get("item_type")
    source_label = "услуге" if item_type == "service" else "товару"
    header = "Заявка на контакт" if payload.get("approval_required") else "Интерес к твоему товару"

    text = (
        f"📦 <b>{header}!</b>\n"
        "\n"
        f"«{title}»\n"
        "\n"
        f"Покупатель: <b>{buyer}</b>"
    )
    if username:
        text += f" (@{username})"
    if payload.get("approval_required"):
        text += f"\nОткрой приложение и реши, открыть ли ему твой Telegram по {source_label}."
    else:
        text += "\nНаписал тебе в ЛС, проверь сообщения 👆"

    return {"text": text, "reply_markup": open_miniapp_kb("📦 Открыть объявление")}


def _format_market_deal_update(payload: dict) -> dict:
    title = _escape(payload.get("item_title", "объявление"))
    event = payload.get("event", "updated")
    deal_id = payload.get("deal_id")

    event_map = {
        "selected": "Продавец выбрал вас по сделке.",
        "in_progress": "Исполнитель начал выполнение услуги.",
        "provider_confirmed": "Продавец подтвердил выполнение. Нужна ваша проверка.",
        "customer_confirmed": "Покупатель подтвердил получение.",
        "completed": "Сделка завершена.",
        "expired": "Срок сделки истёк.",
        "dispute_open": "Открыт спор по сделке.",
        "cancelled": "Сделка отменена.",
        "resolved_completed": "Спор решён: сделка завершена.",
        "resolved_cancelled": "Спор решён: сделка отменена.",
        "reassigned": "Покупатель в сделке изменён.",
    }
    status_line = event_map.get(event, "Статус сделки обновлён.")

    text = (
        "📦 <b>Обновление по сделке</b>\n"
        "\n"
        f"«{title}»\n"
        f"{status_line}"
    )

    kb = open_market_deal_kb(int(deal_id)) if deal_id else open_miniapp_kb("📦 Открыть маркет")
    return {"text": text, "reply_markup": kb}


def _format_request_response(payload: dict) -> dict:
    responder = _escape(payload.get("responder_name", "Кто-то"))
    username = _clean_username(payload.get("responder_username"))
    title = _escape(payload.get("request_title", "запрос"))

    text = (
        "🙋 <b>Отклик на твой запрос!</b>\n"
        "\n"
        f"«{title}»\n"
        "\n"
        f"Откликнулся: <b>{responder}</b>"
    )
    if username:
        text += f" (@{username})"
    text += "\nНаписал тебе в ЛС 👆"

    return {"text": text, "reply_markup": open_miniapp_kb("📋 Открыть запрос")}


def _format_contact_request_decision(payload: dict) -> dict:
    decision = payload.get("decision") or payload.get("contact_status")
    owner = _escape(payload.get("owner_name", "Пользователь"))
    username = _clean_username(payload.get("owner_username"))
    source_title = _escape(payload.get("source_title", ""))
    source_item_type = payload.get("source_item_type") or payload.get("item_type")
    source_label = "услуге" if source_item_type == "service" else "товару"

    if decision == "accepted":
        text = (
            "✅ <b>Контакт открыт</b>\n\n"
            f"{owner} принял(а) заявку по {source_label}"
        )
        if source_title:
            text += f" «{source_title}»"
        if username:
            text += f"\n\nTelegram: @{_escape(username)}"
        else:
            text += "\n\nУ пользователя пока нет публичного @username."
    else:
        text = (
            "↩️ <b>Заявка отклонена</b>\n\n"
            f"{owner} не открыл(а) контакт по {source_label}"
        )
        if source_title:
            text += f" «{source_title}»"

    return {"text": text, "reply_markup": open_miniapp_kb()}


def _format_milestone(payload: dict) -> dict:
    milestone = payload.get("milestone", 0)
    title = _escape(payload.get("post_title", "пост"))
    post_id = payload.get("post_id")

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

    type_labels = {
        "post": "Пост",
        "comment": "Комментарий",
        "request": "Запрос",
        "market_item": "Товар",
        "dating_profile": "Профиль Dating",
    }
    readable_type = type_labels.get(target_type, target_type)

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
        "⚠️ <b>Новый репорт</b>\n"
        "\n"
        f"📌 Тип: {readable_type}\n"
        f"📝 Причина: {readable_reason}"
    )

    return {"text": text, "reply_markup": admin_report_kb()}


FOLLOWUP_ANSWERS = {
    ("market_sold", "yes"): "🎉 Отлично! Объявление снято. Поздравляю!",
    ("market_sold", "no"): "👌 Понял, объявление остаётся активным. Удачи!",
    ("market_sold", "in_progress"): "💬 Понял, напишу через пару дней 👌",
    ("request_resolved", "yes"): "🎉 Отлично! Запрос закрыт. Рад, что помогло!",
    ("request_resolved", "no"): "👌 Понял, запрос остается активным. Удачи!",
    ("request_resolved", "in_progress"): "💬 Понял, напишу через пару дней 👌",
}


def get_followup_answer_text(followup_type: str, answer: str) -> str:
    """Текст ответа юзеру после нажатия кнопки follow-up."""
    return FOLLOWUP_ANSWERS.get((followup_type, answer), "👌 Принято!")


def _escape(text: str) -> str:
    """Экранирование HTML-символов для безопасного отображения."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _vote_word(count: int) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return "голос"
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return "голоса"
    return "голосов"
