# ===== FILE: bot/handlers/start.py =====
# Хэндлер команды /start и deeplink-параметров.

import logging

from aiogram import F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import Message

from keyboards.inline import open_miniapp_kb
from templates.messages import format_welcome

logger = logging.getLogger(__name__)

router = Router(name="start")


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

    if args.startswith("enable_notifications"):
        msg = format_welcome()
        await message.answer(
            text=msg["text"],
            reply_markup=msg["reply_markup"],
        )
        return

    if args.startswith("profile_"):
        await message.answer(
            text="👤 Открой приложение, чтобы посмотреть профиль:",
            reply_markup=open_miniapp_kb("📱 Открыть профиль"),
        )
        return

    msg = format_welcome()
    await message.answer(
        text=msg["text"],
        reply_markup=msg["reply_markup"],
    )


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обычный /start без параметров."""
    telegram_id = message.from_user.id
    logger.info(f"👤 /start от {telegram_id}")

    msg = format_welcome()
    await message.answer(
        text=msg["text"],
        reply_markup=msg["reply_markup"],
    )


@router.message(F.text)
async def handle_text(message: Message):
    """
    Любое текстовое сообщение — направляем в mini app.
    Бот не ведет диалог, используется для уведомлений.
    """
    await message.answer(
        text=(
            "Я бот-уведомитель CampusApp 🤖\n"
            "\n"
            "Мне не нужно писать — я сам пришлю тебе "
            "матчи, комментарии и отклики.\n"
            "\n"
            "Все общение — в приложении 👇"
        ),
        reply_markup=open_miniapp_kb(),
    )
