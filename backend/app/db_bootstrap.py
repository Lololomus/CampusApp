from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app import models  # noqa: F401 - ensure metadata is fully loaded
from app.config import get_settings
from app.database import Base

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _alembic_config() -> Config:
    settings = get_settings()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    return config


def _has_user_tables(table_names: set[str]) -> bool:
    return bool({name for name in table_names if name != "alembic_version"})


async def _prepare_database() -> bool:
    settings = get_settings()
    engine = create_async_engine(
        settings.database_url,
        echo=settings.sql_echo,
        poolclass=NullPool,
    )

    try:
        async with engine.begin() as conn:
            existing_tables = await conn.run_sync(
                lambda sync_conn: set(inspect(sync_conn).get_table_names(schema="public"))
            )

            if not _has_user_tables(existing_tables):
                print("==> Fresh database detected; creating schema from SQLAlchemy metadata")
                await conn.run_sync(Base.metadata.create_all)
                return True

            return False
    finally:
        await engine.dispose()


def main() -> None:
    if asyncio.run(_prepare_database()):
        print("==> Stamping fresh schema with Alembic head")
        command.stamp(_alembic_config(), "head")
        return

    print("==> Existing database detected; running Alembic migrations")
    command.upgrade(_alembic_config(), "head")


if __name__ == "__main__":
    main()
