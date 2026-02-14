# ===== 📄 ФАЙЛ: bot/handlers/callbacks.py =====
# Обработчик inline-кнопок: ответы на follow-up'ы.

import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery

from services.api_client import api_client
from templates.messages import get_followup_answer_text

logger = logging.getLogger(__name__)

router = Router(name="callbacks")


@router.callback_query(F.data.startswith("fu:"))
async def handle_followup_answer(callback: CallbackQuery):
    """
    Обработка ответа на follow-up.
    Формат callback_data: fu:{followup_id}:{answer}
    
    Примеры:
      fu:42:yes         → "Да, продал" / "Да, помогли"
      fu:42:no          → "Нет"
      fu:42:in_progress → "Общаемся" / "В процессе"
    """
    try:
        parts = callback.data.split(":")
        if len(parts) != 3:
            await callback.answer("⚠️ Некорректные данные", show_alert=True)
            return

        _, followup_id_str, answer = parts
        followup_id = int(followup_id_str)

        # Валидация ответа
        if answer not in ("yes", "no", "in_progress"):
            await callback.answer("⚠️ Неизвестный ответ", show_alert=True)
            return

        logger.info(f"📩 Follow-up #{followup_id}: ответ '{answer}' от {callback.from_user.id}")

        # Отправляем ответ в бэкенд
        result = await api_client.answer_followup(followup_id, answer)

        if result.get("ok"):
            action = result.get("action", "")

            # Определяем тип follow-up для правильного текста ответа
            # Тип определяем по кнопкам в сообщении
            followup_type = _detect_followup_type(callback.message)

            # Текст ответа юзеру
            answer_text = get_followup_answer_text(followup_type, answer)

            # Обновляем сообщение — убираем кнопки, показываем результат
            await callback.message.edit_text(
                text=f"{callback.message.text}\n\n✅ <b>{answer_text}</b>",
                reply_markup=None,  # убираем кнопки
            )

            # Popup подтверждение
            await callback.answer("✅ Принято!")

        else:
            error = result.get("error", "Неизвестная ошибка")
            logger.error(f"❌ Ошибка ответа follow-up #{followup_id}: {error}")
            await callback.answer("⚠️ Ошибка, попробуй позже", show_alert=True)

    except ValueError:
        await callback.answer("⚠️ Некорректный ID", show_alert=True)

    except Exception as e:
        logger.error(f"❌ Ошибка обработки callback: {e}")
        await callback.answer("⚠️ Что-то пошло не так", show_alert=True)


def _detect_followup_type(message) -> str:
    """
    Определяем тип follow-up по тексту сообщения.
    Простая эвристика — ищем ключевые слова.
    """
    text = message.text or message.html_text or ""
    
    if "товар" in text.lower() or "продал" in text.lower():
        return "market_sold"
    elif "запрос" in text.lower() or "решён" in text.lower():
        return "request_resolved"
    
    return "market_sold"  # fallback
