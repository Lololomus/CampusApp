"""add item_type to market_items

Revision ID: 011_add_market_item_type
Revises: 010_add_memes_post_category
Create Date: 2026-03-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011_add_market_item_type"
down_revision: Union[str, Sequence[str], None] = "010_add_memes_post_category"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE market_item_type_enum AS ENUM ('product', 'service')")
    op.add_column(
        'market_items',
        sa.Column(
            'item_type',
            postgresql.ENUM('product', 'service', name='market_item_type_enum', create_type=False),
            nullable=False,
            server_default='product',
        )
    )
    op.create_index('ix_market_items_item_type', 'market_items', ['item_type'])


def downgrade() -> None:
    op.drop_index('ix_market_items_item_type', 'market_items')
    op.drop_column('market_items', 'item_type')
    op.execute("DROP TYPE market_item_type_enum")
