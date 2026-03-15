from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum

MIN_ITEMS = 1
MAX_ITEMS = 5


class ImageFormat(Enum):
    SQUARE = "square"   # 1080x1080
    STORY  = "story"    # 1080x1920
    BANNER = "banner"   # 1920x1080


# Словарь смещений элементов для drag-редактора: {"title": (dx, dy), ...}
ElementOffsets = dict[str, tuple[int, int]]
BBoxes = dict[str, tuple[int, int, int, int]]

ELEMENT_NAMES = ["title", "badge", "date", "divider", "col_features", "col_fixes", "footer"]


@dataclass(frozen=True)
class UpdateItem:
    title: str
    text: str


@dataclass(frozen=True)
class UpdatePayload:
    date: str
    version: str
    title_line_1: str
    title_line_2: str
    footer_left: str
    footer_right: str
    features: list[UpdateItem]
    fixes: list[UpdateItem]

    def to_dict(self) -> dict[str, object]:
        return {
            "date": self.date,
            "version": self.version,
            "title_line_1": self.title_line_1,
            "title_line_2": self.title_line_2,
            "footer_left": self.footer_left,
            "footer_right": self.footer_right,
            "features": [{"title": item.title, "text": item.text} for item in self.features],
            "fixes": [{"title": item.title, "text": item.text} for item in self.fixes],
        }


def default_payload() -> UpdatePayload:
    today = datetime.now().strftime("%d.%m.%Y")
    return UpdatePayload(
        date=today,
        version="2.4",
        title_line_1="АПДЕЙТ",
        title_line_2="КАМПУСА",
        footer_left="// CAMPUS LIFE",
        footer_right="СПАСИБО ЗА ФИДБЭК",
        features=[
            UpdateItem(title="Темная тема", text="в апке: ваши глаза скажут спасибо"),
            UpdateItem(title="Бронь в 2 клика", text="переговорки без экселек и очередей"),
            UpdateItem(title="Умные пуши", text="напоминаем про пары и сырники"),
        ],
        fixes=[
            UpdateItem(
                title="Расписание летает",
                text="грузится быстрее, чем ты идешь на пару",
            ),
            UpdateItem(
                title="Фикс авторизации",
                text="больше не выкидывает из аккаунта",
            ),
            UpdateItem(
                title="Минус спам",
                text="убрали дублирующиеся уведомления",
            ),
        ],
    )

