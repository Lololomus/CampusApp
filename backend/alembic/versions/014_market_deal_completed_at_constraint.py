"""enforce completed_at for completed market deals

Revision ID: 014_mkt_deal_done_ts
Revises: 013_deal_flow_v2
Create Date: 2026-03-19
"""

from typing import Sequence, Union

from alembic import op


revision: str = "014_mkt_deal_done_ts"
down_revision: Union[str, Sequence[str], None] = "013_deal_flow_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE market_deals
        SET completed_at = COALESCE(completed_at, updated_at, created_at, now())
        WHERE status = 'completed' AND completed_at IS NULL
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'ck_market_deals_completed_requires_timestamp'
                  AND conrelid = 'market_deals'::regclass
            ) THEN
                ALTER TABLE market_deals
                ADD CONSTRAINT ck_market_deals_completed_requires_timestamp
                CHECK (status <> 'completed' OR completed_at IS NOT NULL);
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE market_deals
        DROP CONSTRAINT IF EXISTS ck_market_deals_completed_requires_timestamp
        """
    )
