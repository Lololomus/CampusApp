"""Add ad_hidden table for per-user ad hiding.

Revision ID: 009_ad_hidden
Revises: 008_poll_explanation
Create Date: 2026-03-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_ad_hidden"
down_revision: Union[str, None] = "008_poll_explanation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ad_hidden",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "ad_post_id",
            sa.Integer(),
            sa.ForeignKey("ad_posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hidden_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("ad_post_id", "user_id", name="unique_ad_hidden"),
    )
    op.create_index("ix_ad_hidden_user", "ad_hidden", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ad_hidden_user", table_name="ad_hidden")
    op.drop_table("ad_hidden")
