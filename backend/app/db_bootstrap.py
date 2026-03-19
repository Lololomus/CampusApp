from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app import models  # noqa: F401 - ensure metadata is fully loaded
from app.config import get_settings
from app.database import Base, engine

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _alembic_config() -> Config:
    settings = get_settings()
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    return config


async def _get_table_names() -> set[str]:
    async with engine.begin() as conn:
        return await conn.run_sync(
            lambda sync_conn: set(inspect(sync_conn).get_table_names(schema="public"))
        )


async def _create_schema_from_models() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def _has_user_tables(table_names: set[str]) -> bool:
    return bool({name for name in table_names if name != "alembic_version"})


def main() -> None:
    existing_tables = asyncio.run(_get_table_names())

    if not _has_user_tables(existing_tables):
        print("==> Fresh database detected; creating schema from SQLAlchemy metadata")
        asyncio.run(_create_schema_from_models())
        asyncio.run(engine.dispose())
        print("==> Stamping fresh schema with Alembic head")
        command.stamp(_alembic_config(), "head")
        return

    asyncio.run(engine.dispose())
    print("==> Existing database detected; running Alembic migrations")
    command.upgrade(_alembic_config(), "head")


if __name__ == "__main__":
    main()
