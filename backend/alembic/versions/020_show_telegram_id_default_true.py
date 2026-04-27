"""set show_telegram_id default true and backfill existing users

Revision ID: 020_show_tg_id_default_true
Revises: 019_add_user_telegram_username
Create Date: 2026-04-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "020_show_tg_id_default_true"
down_revision: Union[str, Sequence[str], None] = "019_add_user_telegram_username"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users", "show_telegram_id",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
        nullable=False,
    )
    op.execute("UPDATE users SET show_telegram_id = TRUE WHERE show_telegram_id IS FALSE OR show_telegram_id IS NULL")


def downgrade() -> None:
    op.alter_column(
        "users", "show_telegram_id",
        existing_type=sa.Boolean(),
        server_default=sa.text("false"),
        nullable=False,
    )
