# ===== 📄 ФАЙЛ: bot/handlers/start.py =====
# Хэндлер команды /start и deeplink'ов.

import logging
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import CommandStart, CommandObject

from templates.messages import format_welcome
from keyboards.inline import open_miniapp_kb

logger = logging.getLogger(__name__)

router = Router(name="start")


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep_link(message: Message, command: CommandObject):
    """
    /start с deeplink параметром.
    Примеры:
      /start enable_notifications_123  → онбординг уведомлений
      /start profile_456              → открыть профиль юзера
    """
    args = command.args or ""
    telegram_id = message.from_user.id

    logger.info(f"👤 /start deep_link='{args}' от {telegram_id}")

    if args.startswith("enable_notifications"):
        # Пришёл из мини-аппа для включения уведомлений
        msg = format_welcome()
        await message.answer(
            text=msg["text"],
            reply_markup=msg["reply_markup"],
        )

    elif args.startswith("profile_"):
        # Открыть чей-то профиль (для share ссылок)
        await message.answer(
            text="👤 Открой приложение чтобы посмотреть профиль:",
            reply_markup=open_miniapp_kb("📱 Открыть профиль"),
        )

    else:
        # Неизвестный deeplink — стандартное приветствие
        msg = format_welcome()
        await message.answer(
            text=msg["text"],
            reply_markup=msg["reply_markup"],
        )


@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обычный /start без параметров"""
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
    Любое текстовое сообщение — направляем в мини-апп.
    Бот не ведёт диалогов, он только для уведомлений.
    """
    await message.answer(
        text=(
            "Я бот-уведомитель CampusApp 🤖\n"
            "\n"
            "Мне не нужно писать — я сам пришлю тебе "
            "матчи, комментарии и отклики!\n"
            "\n"
            "Всё общение — в приложении 👇"
        ),
        reply_markup=open_miniapp_kb(),
    )
