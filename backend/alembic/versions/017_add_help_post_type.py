"""add help post type and resolve fields

Revision ID: 017_add_help_post_type
Revises: 016_post_target_uni
Create Date: 2026-04-05
"""

from typing import Sequence, Union
from alembic import op


revision: str = "017_add_help_post_type"
down_revision: Union[str, Sequence[str], None] = "016_post_target_uni"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем новое значение в enum (PostgreSQL не поддерживает IF NOT EXISTS для ADD VALUE)
    op.execute("ALTER TYPE post_category_enum ADD VALUE IF NOT EXISTS 'help'")

    op.execute(
        """
        ALTER TABLE posts
            ADD COLUMN IF NOT EXISTS help_expires_at TIMESTAMP DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS is_resolved     BOOLEAN   NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMP DEFAULT NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE posts
            DROP COLUMN IF EXISTS help_expires_at,
            DROP COLUMN IF EXISTS is_resolved,
            DROP COLUMN IF EXISTS resolved_at;
        """
    )
    # Примечание: PostgreSQL не поддерживает удаление значений из enum.
    # Для полного отката нужно пересоздать тип вручную.
