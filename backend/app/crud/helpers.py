# ===== 📄 ФАЙЛ: backend/app/crud/helpers.py =====
# Общие утилиты для CRUD-модулей
#
# ✅ Фаза 1.4: sanitize_json_field теперь возвращает list/dict (не строку)
#    для совместимости с JSONB-колонками.
# ✅ Фаза 3: Без изменений — чистый Python, нет DB-вызовов.
# ✅ Фаза 5.2: merge_images() — единая логика слияния изображений

from typing import Any, Optional, Union, List, Dict, Tuple
import json


def sanitize_json_field(value: Any) -> Optional[Union[list, dict]]:
    """
    Нормализация значения для записи в JSONB-колонку.

    Принимает list, dict, JSON-строку или None.
    Возвращает нативный Python-объект (list/dict) или None.

    ✅ JSONB: SQLAlchemy автоматически сериализует list/dict → JSON в PostgreSQL.
       Не нужно вызывать json.dumps() вручную.
    """
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        if not value.strip():
            return None
        try:
            parsed = json.loads(value)
            if isinstance(parsed, (list, dict)):
                return parsed
            return None
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
    return None


def merge_images(
    old_images: Optional[List],
    new_images_meta: Optional[List[dict]] = None,
    keep_filenames: Optional[List[str]] = None,
    require_at_least_one: bool = False,
    keep_old_videos: bool = True,
) -> Tuple[List[dict], List[str]]:
    """
    Единая логика слияния изображений при обновлении поста/товара.

    ✅ Фаза 5.2: Вынесено из crud/posts.py и crud/market.py
    ✅ Поддержка видео: items с type="video" сохраняются и удаляются отдельно.

    Args:
        old_images: текущие изображения/видео из БД (list of str|dict)
        new_images_meta: новые загруженные медиа [{url, w, h, ...}, ...]
        keep_filenames: имена файлов из старых изображений, которые нужно оставить
        require_at_least_one: если True — ValueError при пустом результате

    Returns:
        (final_images_meta, files_to_delete):
            final_images_meta — итоговый список медиа
            files_to_delete — ключи удалённых изображений для очистки storage
            (видео удаляются сразу внутри этой функции через delete_video)
    """
    from app.utils import get_storage_key
    from app.video_utils import delete_video

    raw_old_images = old_images or []

    # Разделяем старые медиа на изображения и видео
    old_images_map: Dict[str, dict] = {}
    old_videos: List[dict] = []

    for img in raw_old_images:
        if isinstance(img, dict) and img.get("type") == "video":
            old_videos.append(img)
            continue
        if isinstance(img, str):
            key = get_storage_key(img, kind="images")
            if key:
                old_images_map[key] = {"url": key, "w": 1000, "h": 1000}
        elif isinstance(img, dict):
            key = get_storage_key(img.get("url", ""), kind="images")
            if key:
                normalized = dict(img)
                normalized["url"] = key
                normalized.setdefault("w", 1000)
                normalized.setdefault("h", 1000)
                old_images_map[key] = normalized

    # Разделяем новые медиа на изображения и видео
    new_images_only: List[dict] = []
    new_videos: List[dict] = []
    for item in (new_images_meta or []):
        if isinstance(item, dict) and item.get("type") == "video":
            new_videos.append(item)
        else:
            new_images_only.append(item)

    # Собираем итоговый список изображений
    final_images_meta: List[dict] = []

    if keep_filenames:
        for fname in keep_filenames:
            key = get_storage_key(fname, kind="images")
            if key and key in old_images_map:
                final_images_meta.append(old_images_map[key])

    final_images_meta.extend(new_images_only)

    # Если пришло новое видео — удаляем старые; если keep_old_videos=False — тоже удаляем
    if new_videos:
        for old_video in old_videos:
            try:
                delete_video(old_video)
            except Exception:
                pass
        final_images_meta.extend(new_videos)
    elif keep_old_videos:
        final_images_meta.extend(old_videos)
    else:
        # Пользователь убрал видео — удаляем файлы, в список не добавляем
        for old_video in old_videos:
            try:
                delete_video(old_video)
            except Exception:
                pass

    if require_at_least_one and not final_images_meta:
        raise ValueError("At least one image is required")

    # Определяем что удалить из storage (только изображения — видео уже удалены выше)
    kept_urls = {
        get_storage_key(img.get("url", ""), kind="images")
        for img in final_images_meta
        if isinstance(img, dict) and img.get("type", "image") != "video"
    }
    kept_urls.discard("")
    files_to_delete = [url for url in old_images_map if url not in kept_urls]

    return final_images_meta, files_to_delete