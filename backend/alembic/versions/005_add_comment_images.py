"""Add JSONB images column to comments.

Revision ID: 005_add_comment_images
Revises: 004_phase4_ad_impression_unique
Create Date: 2026-03-08
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "005_add_comment_images"
down_revision: Union[str, None] = "004_phase4_ad_impression_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.comments') IS NULL THEN
                RETURN;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comments'
                  AND column_name = 'images'
            ) THEN
                ALTER TABLE comments
                ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb;
            END IF;

            UPDATE comments
            SET images = '[]'::jsonb
            WHERE images IS NULL;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comments'
                  AND column_name = 'images'
            ) THEN
                ALTER TABLE comments DROP COLUMN images;
            END IF;
        END$$;
        """
    )
