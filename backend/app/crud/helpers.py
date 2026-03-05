# ===== 📄 ФАЙЛ: backend/app/crud/helpers.py =====
# Общие утилиты для CRUD-модулей
#
# ✅ Фаза 1.4: sanitize_json_field теперь возвращает list/dict (не строку)
#    для совместимости с JSONB-колонками.
# ✅ Фаза 3: Без изменений — чистый Python, нет DB-вызовов.

from typing import Any, Optional, Union
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