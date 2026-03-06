"""Phase 4.3: add UNIQUE(ad_post_id, user_id) to ad_impressions.

Revision ID: 004_phase4_ad_impression_unique
Revises: 002_phase1_model_schema
Create Date: 2026-03-06
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "004_phase4_ad_impression_unique"
down_revision: Union[str, None] = "002_phase1_model_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Deduplicate legacy rows before adding UNIQUE constraint.
    op.execute(
        """
        DELETE FROM ad_impressions ai
        WHERE ai.id NOT IN (
            SELECT MIN(id)
            FROM ad_impressions
            GROUP BY ad_post_id, user_id
        );
        """
    )

    # Add constraint only if it doesn't exist yet.
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.ad_impressions') IS NULL THEN
                RETURN;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'unique_ad_impression'
                  AND conrelid = 'ad_impressions'::regclass
            ) THEN
                ALTER TABLE ad_impressions
                ADD CONSTRAINT unique_ad_impression
                UNIQUE (ad_post_id, user_id);
            END IF;
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
                FROM pg_constraint
                WHERE conname = 'unique_ad_impression'
                  AND conrelid = 'ad_impressions'::regclass
            ) THEN
                ALTER TABLE ad_impressions
                DROP CONSTRAINT unique_ad_impression;
            END IF;
        END$$;
        """
    )
