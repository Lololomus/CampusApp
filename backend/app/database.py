# ===== FILE: backend/app/database.py =====
#
# ✅ Фаза 1.5: Connection Pool
# ✅ Фаза 2: Async engine + AsyncSession + sync fallback

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()


# ---------------------------------------------------------------------------
#  URL helpers
# ---------------------------------------------------------------------------

def _to_async_url(url: str) -> str:
    """Ensure URL uses asyncpg driver for async engine."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def _to_sync_url(url: str) -> str:
    """Ensure URL uses default psycopg2 driver for sync engine."""
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


# ---------------------------------------------------------------------------
#  Pool settings (shared)
# ---------------------------------------------------------------------------

_pool_kwargs = dict(
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
)


# ---------------------------------------------------------------------------
#  Async engine + session  (PRIMARY — use for all new code)
# ---------------------------------------------------------------------------

ASYNC_DATABASE_URL = _to_async_url(settings.database_url)

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=settings.sql_echo,
    **_pool_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,     # ← важно для async: объекты доступны после commit
    autocommit=False,
    autoflush=False,
)


async def get_db():
    """FastAPI dependency — yields AsyncSession."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ---------------------------------------------------------------------------
#  Sync engine + session  (DEPRECATED — only for not-yet-converted code)
#  Will be removed in Phase 3.11.
# ---------------------------------------------------------------------------

SYNC_DATABASE_URL = _to_sync_url(settings.database_url)

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=settings.sql_echo,
    **_pool_kwargs,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)


def get_db_sync():                              # DEPRECATED — фаза 3 удалит
    """Sync DB dependency. Used by routers not yet converted to async."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
#  Common
# ---------------------------------------------------------------------------

Base = declarative_base()


def init_db():
    """Create all tables in DB (MVP mode). Uses sync engine."""
    from app.models import (                    # noqa: F401 — нужен для metadata
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
    Base.metadata.create_all(bind=sync_engine)