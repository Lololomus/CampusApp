"""add target_university field to posts

Revision ID: 016_post_target_uni
Revises: 015_add_post_scope
Create Date: 2026-03-31
"""

from typing import Sequence, Union

from alembic import op


revision: str = "016_post_target_uni"
down_revision: Union[str, Sequence[str], None] = "015_add_post_scope"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS target_university VARCHAR(255) DEFAULT NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE posts DROP COLUMN IF EXISTS target_university;
        """
    )
