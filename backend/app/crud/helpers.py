# ===== 📄 ФАЙЛ: backend/app/crud/helpers.py =====
# Общие утилиты для CRUD-модулей

from typing import Any, Optional
import json


def sanitize_json_field(value: Any) -> Optional[str]:
    """Безопасная сериализация JSON с защитой от ошибок"""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return None