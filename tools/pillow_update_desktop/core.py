from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

from PIL import Image

from .model import MAX_ITEMS, MIN_ITEMS

STRICT_DATE_PATTERN = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")
SLUG_ALLOWED_PATTERN = re.compile(r"[^0-9A-Za-zА-Яа-яЁё._-]+")
MULTI_DASH_PATTERN = re.compile(r"-+")


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _clean_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _normalize_items(items: list[Mapping[str, Any]]) -> list[dict[str, str]]:
    return [{"title": _clean_text(item.get("title")), "text": _clean_text(item.get("text"))} for item in items]


def normalize_payload(raw_payload: Mapping[str, Any]) -> dict[str, Any]:
    features = raw_payload.get("features", [])
    fixes = raw_payload.get("fixes", [])

    return {
        "date": _clean_text(raw_payload.get("date")),
        "version": _clean_text(raw_payload.get("version")),
        "title_line_1": _clean_text(raw_payload.get("title_line_1")),
        "title_line_2": _clean_text(raw_payload.get("title_line_2")),
        "footer_left": _clean_text(raw_payload.get("footer_left")),
        "footer_right": _clean_text(raw_payload.get("footer_right")),
        "features": _normalize_items(features if isinstance(features, list) else []),
        "fixes": _normalize_items(fixes if isinstance(fixes, list) else []),
    }


def validate_payload(raw_payload: Mapping[str, Any]) -> list[str]:
    payload = normalize_payload(raw_payload)
    errors: list[str] = []

    date_value = payload["date"]
    if not date_value:
        errors.append("Поле 'Дата' обязательно.")
    elif not STRICT_DATE_PATTERN.match(date_value):
        errors.append("Дата должна быть в формате DD.MM.YYYY.")
    else:
        try:
            datetime.strptime(date_value, "%d.%m.%Y")
        except ValueError:
            errors.append("Дата содержит некорректное значение.")

    if not payload["version"]:
        errors.append("Поле 'Версия' обязательно.")

    if not payload["title_line_1"]:
        errors.append("Поле 'Заголовок 1' обязательно.")
    if not payload["title_line_2"]:
        errors.append("Поле 'Заголовок 2' обязательно.")
    if not payload["footer_left"]:
        errors.append("Поле 'Левый футер' обязательно.")
    if not payload["footer_right"]:
        errors.append("Поле 'Правый футер' обязательно.")

    errors.extend(_validate_items(payload["features"], "Что добавили"))
    errors.extend(_validate_items(payload["fixes"], "Что починили"))

    return errors


def _validate_items(items: list[dict[str, str]], label: str) -> list[str]:
    errors: list[str] = []
    if not (MIN_ITEMS <= len(items) <= MAX_ITEMS):
        errors.append(f"Секция '{label}' должна содержать от {MIN_ITEMS} до {MAX_ITEMS} пунктов (сейчас: {len(items)}).")
        return errors

    for index, item in enumerate(items, start=1):
        if not item["title"]:
            errors.append(f"'{label}' пункт {index}: поле 'title' обязательно.")
        if not item["text"]:
            errors.append(f"'{label}' пункт {index}: поле 'text' обязательно.")
    return errors


def to_folder_date(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%d.%m.%Y")
    return dt.strftime("%Y-%m-%d")


def slugify(value: str, fallback: str = "update") -> str:
    lowered = value.strip().lower()
    cleaned = SLUG_ALLOWED_PATTERN.sub("-", lowered)
    single_dash = MULTI_DASH_PATTERN.sub("-", cleaned)
    slug = single_dash.strip("-_.")
    return slug or fallback


def build_base_folder_name(payload: Mapping[str, Any]) -> str:
    normalized = normalize_payload(payload)
    date_part = to_folder_date(normalized["date"])
    version_part = slugify(normalized["version"], fallback="0")
    first_feature_title = normalized["features"][0]["title"] if normalized["features"] else ""
    feature_slug = slugify(first_feature_title, fallback="update")
    return f"{date_part}_v{version_part}_{feature_slug}"


def ensure_unique_directory(parent: Path, base_name: str) -> Path:
    candidate = parent / base_name
    if not candidate.exists():
        candidate.mkdir(parents=True, exist_ok=False)
        return candidate

    suffix = 2
    while True:
        next_candidate = parent / f"{base_name}_{suffix}"
        if not next_candidate.exists():
            next_candidate.mkdir(parents=True, exist_ok=False)
            return next_candidate
        suffix += 1


def save_update(
    raw_payload: Mapping[str, Any],
    preview_image: Image.Image,
    project_root: Path | None = None,
) -> Path:
    errors = validate_payload(raw_payload)
    if errors:
        raise ValueError("; ".join(errors))

    payload = normalize_payload(raw_payload)
    root = project_root or get_project_root()
    updates_dir = root / "updates"
    updates_dir.mkdir(parents=True, exist_ok=True)

    folder_name = build_base_folder_name(payload)
    update_dir = ensure_unique_directory(updates_dir, folder_name)

    preview_path = update_dir / "preview.png"
    preview_image.save(preview_path, format="PNG")

    json_payload = dict(payload)
    json_payload["saved_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    json_path = update_dir / "update.json"
    json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return update_dir

