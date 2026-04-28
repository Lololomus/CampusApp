# ===== FILE: bot/handlers/start.py =====
# Хэндлер команды /start и deeplink-параметров.

import logging

from aiogram import F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import FSInputFile, Message

from config import WELCOME_PHOTO_PATH
from keyboards.inline import open_miniapp_kb
from templates.messages import format_welcome
from services.api_client import api_client

logger = logging.getLogger(__name__)

router = Router(name="start")


async def send_welcome(message: Message, name: str = ""):
    msg = format_welcome(name)
    if WELCOME_PHOTO_PATH.is_file():
        await message.answer_photo(
            photo=FSInputFile(WELCOME_PHOTO_PATH),
            caption=msg["text"],
            reply_markup=msg["reply_markup"],
            parse_mode="HTML",
        )
        return

    logger.warning("Welcome photo not found: %s", WELCOME_PHOTO_PATH)
    await message.answer(
        text=msg["text"],
        reply_markup=msg["reply_markup"],
        parse_mode="HTML",
    )


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(message: Message, command: CommandObject):
    """
    /start с deeplink параметром.
    Примеры:
      /start enable_notifications_123 -> онбординг уведомлений
      /start profile_456              -> открыть профиль пользователя
    """
    args = command.args or ""
    telegram_id = message.from_user.id

    logger.info(f"👤 /start deep_link='{args}' от {telegram_id}")

    name = message.from_user.first_name or ""

    if args.startswith("enable_notifications"):
        await send_welcome(message, name)
        return

    if args.startswith("profile_"):
        await message.answer(
            text="👤 Открой приложение, чтобы посмотреть профиль:",
            reply_markup=open_miniapp_kb("📱 Открыть профиль"),
        )
        return

    await send_welcome(message, name)


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обычный /start без параметров."""
    telegram_id = message.from_user.id
    logger.info(f"👤 /start от {telegram_id}")

    name = message.from_user.first_name or ""
    await send_welcome(message, name)


@router.message(F.text)
async def handle_text(message: Message):
    """
    Любое текстовое сообщение.
    Сначала проверяем pending_text отзыв — если есть, сохраняем текст.
    Иначе — редирект в mini app.
    """
    pending = await api_client.get_pending_review(telegram_id=message.from_user.id)
    if pending and pending.get("review_id"):
        review_id = pending["review_id"]
        text = (message.text or "")[:300]
        await api_client.add_review_text(
            telegram_id=message.from_user.id,
            review_id=review_id,
            text=text,
        )
        await message.answer("✅ Спасибо за отзыв!")
        return

    await message.answer(
        text=(
            "Я уведомляю, а не общаюсь 🤖\n"
            "\n"
            "Мне не нужно писать — я сам пришлю тебе\n"
            "мэтчи, комментарии и отклики.\n"
            "\n"
            "Всё общение — в приложении 👇"
        ),
        reply_markup=open_miniapp_kb(),
    )
