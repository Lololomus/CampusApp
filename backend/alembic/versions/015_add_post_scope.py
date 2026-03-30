"""add scope field to posts

Revision ID: 015_add_post_scope
Revises: 014_mkt_deal_done_ts
Create Date: 2026-03-24
"""

from typing import Sequence, Union

from alembic import op


revision: str = "015_add_post_scope"
down_revision: Union[str, Sequence[str], None] = "014_mkt_deal_done_ts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'university';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE posts DROP COLUMN IF EXISTS scope;
        """
    )
