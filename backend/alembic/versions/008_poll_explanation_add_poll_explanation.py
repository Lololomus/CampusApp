"""add poll explanation

Revision ID: 008_poll_explanation
Revises: 007_add_analytics_tables
Create Date: 2026-03-13 20:50:38.558410

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '008_poll_explanation'
down_revision: Union[str, Sequence[str], None] = '007_add_analytics_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('polls', sa.Column('explanation', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('polls', 'explanation')
