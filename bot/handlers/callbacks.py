# ===== FILE: bot/handlers/callbacks.py =====
# Обработчик inline-кнопок: ответы на follow-up.

import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery

from services.api_client import api_client
from templates.messages import get_followup_answer_text
from keyboards.inline import review_text_skip_kb

logger = logging.getLogger(__name__)

router = Router(name="callbacks")


@router.callback_query(F.data.startswith("fu:"))
async def handle_followup_answer(callback: CallbackQuery):
    """
    Обработка ответа на follow-up.
    Формат callback_data: fu:{followup_id}:{answer}
    """
    try:
        parts = callback.data.split(":")
        if len(parts) != 3:
            await callback.answer("⚠️ Некорректные данные", show_alert=True)
            return

        _, followup_id_str, answer = parts
        followup_id = int(followup_id_str)

        if answer not in ("yes", "no", "in_progress"):
            await callback.answer("⚠️ Неизвестный ответ", show_alert=True)
            return

        logger.info(
            f"📩 Follow-up #{followup_id}: ответ '{answer}' от {callback.from_user.id}"
        )

        result = await api_client.answer_followup(followup_id, answer)

        if result.get("ok"):
            followup_type = _detect_followup_type(callback.message)
            answer_text = get_followup_answer_text(followup_type, answer)

            await callback.message.edit_text(
                text=f"{callback.message.text}\n\n✅ <b>{answer_text}</b>",
                reply_markup=None,
            )
            await callback.answer("✅ Принято!")
            return

        error = result.get("error", "Неизвестная ошибка")
        logger.error(f"❌ Ошибка ответа follow-up #{followup_id}: {error}")
        await callback.answer("⚠️ Ошибка, попробуй позже", show_alert=True)

    except ValueError:
        await callback.answer("⚠️ Некорректный ID", show_alert=True)
    except Exception as exc:
        logger.error(f"❌ Ошибка обработки callback: {exc}")
        await callback.answer("⚠️ Что-то пошло не так", show_alert=True)


@router.callback_query(F.data.startswith("rv:"))
async def handle_review_rating(callback: CallbackQuery):
    """Покупатель выбрал оценку ⭐."""
    try:
        _, item_id_str, seller_id_str, rating_str = callback.data.split(":")
        item_id, seller_id, rating = int(item_id_str), int(seller_id_str), int(rating_str)
    except (ValueError, TypeError):
        await callback.answer("⚠️ Некорректные данные", show_alert=True)
        return

    result = await api_client.create_review(
        telegram_id=callback.from_user.id,
        item_id=item_id,
        seller_id=seller_id,
        rating=rating,
        source="bot",
        status="pending_text",
    )

    if result.get("error") == "already_exists":
        await callback.message.edit_text("✅ Отзыв уже оставлен", reply_markup=None)
        await callback.answer()
        return

    if result.get("error"):
        await callback.answer("⚠️ Ошибка, попробуй позже", show_alert=True)
        return

    review_id = result["id"]
    await callback.message.edit_text(
        f"{callback.message.text}\n\n{rating}⭐ принято!",
        reply_markup=None,
    )
    await callback.message.answer(
        "✍️ Напиши комментарий продавцу (или нажми Пропустить):",
        reply_markup=review_text_skip_kb(review_id),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("rv_skip:"))
async def handle_review_skip(callback: CallbackQuery):
    """Покупатель пропустил весь отзыв."""
    try:
        item_id = int(callback.data.split(":")[1])
    except (ValueError, IndexError):
        await callback.answer("⚠️ Некорректные данные", show_alert=True)
        return

    await api_client.skip_review_request(
        telegram_id=callback.from_user.id,
        item_id=item_id,
    )
    await callback.message.edit_text(
        f"{callback.message.text}\n\n👋 Хорошо, пропускаем",
        reply_markup=None,
    )
    await callback.answer()


@router.callback_query(F.data.startswith("rv_text_skip:"))
async def handle_review_text_skip(callback: CallbackQuery):
    """Покупатель пропустил добавление текста — сохраняем только звёзды."""
    try:
        review_id = int(callback.data.split(":")[1])
    except (ValueError, IndexError):
        await callback.answer("⚠️ Некорректные данные", show_alert=True)
        return

    await api_client.add_review_text(
        telegram_id=callback.from_user.id,
        review_id=review_id,
        text=None,
    )
    await callback.message.edit_text("✅ Отзыв сохранён!", reply_markup=None)
    await callback.answer()


def _detect_followup_type(message) -> str:
    """Определяем тип follow-up по тексту сообщения."""
    text = (message.text or message.html_text or "").lower()

    if "товар" in text or "продал" in text:
        return "market_sold"
    if "запрос" in text or "решен" in text or "решён" in text:
        return "request_resolved"

    return "market_sold"
