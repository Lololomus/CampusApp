# ===== рџ“„ Р¤РђР™Р›: bot/keyboards/inline.py =====

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from config import MINIAPP_URL


def open_miniapp_kb(text: str = "рџ“± РћС‚РєСЂС‹С‚СЊ CampusApp") -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєР° РѕС‚РєСЂС‹С‚РёСЏ РјРёРЅРё-Р°РїРїР°"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=text, web_app=WebAppInfo(url=MINIAPP_URL))]
    ])


def open_post_kb(post_id: int) -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєР° РѕС‚РєСЂС‹С‚РёСЏ РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ РїРѕСЃС‚Р°"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="рџ”— РћС‚РєСЂС‹С‚СЊ РїРѕСЃС‚",
            web_app=WebAppInfo(url=f"{MINIAPP_URL}?post={post_id}")
        )]
    ])


def open_dating_kb() -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєР° РѕС‚РєСЂС‹С‚РёСЏ Dating"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="рџ’ РћС‚РєСЂС‹С‚СЊ Dating",
            web_app=WebAppInfo(url=f"{MINIAPP_URL}?tab=dating")
        )]
    ])


def match_kb(username: str = None) -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєРё РїСЂРё РјР°С‚С‡Рµ: РЅР°РїРёСЃР°С‚СЊ + РѕС‚РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ"""
    buttons = []
    if username:
        buttons.append([
            InlineKeyboardButton(text="рџ’¬ РќР°РїРёСЃР°С‚СЊ", url=f"https://t.me/{username}")
        ])
    buttons.append([
        InlineKeyboardButton(
            text="вќ¤пёЏ РћС‚РєСЂС‹С‚СЊ РїСЂРѕС„РёР»СЊ",
            web_app=WebAppInfo(url=f"{MINIAPP_URL}?tab=dating")
        )
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def followup_market_kb(followup_id: int) -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєРё follow-up: РїСЂРѕРґР°Р» С‚РѕРІР°СЂ?"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="вњ… Р”Р°, РїСЂРѕРґР°Р»",
                callback_data=f"fu:{followup_id}:yes"
            ),
            InlineKeyboardButton(
                text="вќЊ РќРµС‚",
                callback_data=f"fu:{followup_id}:no"
            ),
        ],
        [
            InlineKeyboardButton(
                text="рџ’¬ РћР±С‰Р°РµРјСЃСЏ",
                callback_data=f"fu:{followup_id}:in_progress"
            ),
        ]
    ])


def followup_request_kb(followup_id: int) -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєРё follow-up: РїРѕРјРѕРіР»Рё СЃ Р·Р°РїСЂРѕСЃРѕРј?"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="вњ… Р”Р°, РїРѕРјРѕРіР»Рё",
                callback_data=f"fu:{followup_id}:yes"
            ),
            InlineKeyboardButton(
                text="вќЊ РќРµС‚, РёС‰Сѓ РµС‰С‘",
                callback_data=f"fu:{followup_id}:no"
            ),
        ],
        [
            InlineKeyboardButton(
                text="рџ’¬ Р’ РїСЂРѕС†РµСЃСЃРµ",
                callback_data=f"fu:{followup_id}:in_progress"
            ),
        ]
    ])


def admin_report_kb() -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєР° РѕС‚РєСЂС‹С‚РёСЏ Р°РґРјРёРЅРєРё РґР»СЏ РјРѕРґРµСЂР°С‚РѕСЂРѕРІ"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="рџ”§ РћС‚РєСЂС‹С‚СЊ Р°РґРјРёРЅРєСѓ",
            web_app=WebAppInfo(url=f"{MINIAPP_URL}?tab=admin")
        )]
    ])


def welcome_kb() -> InlineKeyboardMarkup:
    """РљРЅРѕРїРєРё РІ welcome-СЃРѕРѕР±С‰РµРЅРёРё"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🚀 Запустить приложение",
            web_app=WebAppInfo(url=MINIAPP_URL)
        )]
    ])
