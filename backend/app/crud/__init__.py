# ===== 📄 ФАЙЛ: backend/app/crud/__init__.py =====
#
# Реэкспорт всех CRUD-функций для обратной совместимости.
# Весь существующий код (`from app import crud` → `crud.get_user_by_id(...)`)
# продолжает работать без изменений.
#
# Структура модулей:
#   helpers.py   — sanitize_json_field и общие утилиты
#   users.py     — User CRUD, кампус, cooldown, статистика
#   posts.py     — Posts, Polls, лайки постов, просмотры
#   comments.py  — Comments, лайки комментариев
#   requests.py  — Requests, отклики, автоистечение
#   dating.py    — Dating: анкеты, лента, лайки, мэтчи
#   market.py    — Market: товары, избранное, категории
#   ads.py       — Реклама: посты, показы, клики, статистика

from app.crud.helpers import *    # noqa: F401,F403
from app.crud.users import *      # noqa: F401,F403
from app.crud.posts import *      # noqa: F401,F403
from app.crud.comments import *   # noqa: F401,F403
from app.crud.requests import *   # noqa: F401,F403
from app.crud.dating import *     # noqa: F401,F403
from app.crud.market import *     # noqa: F401,F403
from app.crud.ads import *        # noqa: F401,F403
