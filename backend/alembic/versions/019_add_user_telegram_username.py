"""add trusted telegram username

Revision ID: 019_add_user_telegram_username
Revises: 018_add_contact_requests
Create Date: 2026-04-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_add_user_telegram_username"
down_revision: Union[str, Sequence[str], None] = "018_add_contact_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_username", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "telegram_username")
