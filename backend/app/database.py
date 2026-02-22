# ===== FILE: backend/app/database.py =====

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

# NOTE:
# Current backend is sync-oriented (routes use `def`, CRUD uses `db.query(...)`).
# Keep DB layer sync for production stability until full async migration is done.
#
# TODO(async-migration, phase 1):
# - Switch engine to `create_async_engine(...)` and AsyncSession.
# - Change `get_db()` to `async def` and yield AsyncSession.
#
# TODO(async-migration, phase 2):
# - Convert all DB routes/services/crud from `db.query(...)` to
#   `await db.execute(select(...))` + `scalars()`.
# - Replace `db.commit()/refresh()/delete()` with awaited async equivalents.
#
# TODO(async-migration, phase 3):
# - Make startup/shutdown DB lifecycle async-safe.
# - Run full regression tests for Posts/Dating/Market/Profile + auth.

settings = get_settings()


def _normalize_database_url(url: str) -> str:
    """
    Accepts asyncpg URL from env and converts it to sync psycopg URL.
    Example:
    postgresql+asyncpg://... -> postgresql://...
    """
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


DATABASE_URL = _normalize_database_url(settings.database_url)

engine = create_engine(
    DATABASE_URL,
    echo=settings.sql_echo,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables in DB (MVP mode)."""
    from app.models import (
        User, Post, Poll, PollVote, PostLike,
        Request, RequestResponse, Comment, CommentLike,
        Match, MarketItem, MarketFavorite,
        DatingProfile, DatingLike,
        ModerationLog, Report, Appeal,
        PostView, MarketItemView,
        AdPost, AdImpression, AdClick,
        NotificationSettings, Notification, Followup,
        AuthSession,
    )
    Base.metadata.create_all(bind=engine)