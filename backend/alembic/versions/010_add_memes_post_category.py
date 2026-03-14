"""add memes category to post_category_enum

Revision ID: 010_add_memes_post_category
Revises: 009_ad_hidden
Create Date: 2026-03-14
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010_add_memes_post_category"
down_revision: Union[str, Sequence[str], None] = "009_ad_hidden"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE post_category_enum ADD VALUE IF NOT EXISTS 'memes'")


def downgrade() -> None:
    # PostgreSQL enum values are not safely removable in-place.
    pass

