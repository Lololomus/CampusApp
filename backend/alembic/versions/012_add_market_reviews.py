"""add market_reviews table

Revision ID: 012_add_market_reviews
Revises: 011_add_market_item_type
Create Date: 2026-03-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_add_market_reviews"
down_revision: Union[str, Sequence[str], None] = "011_add_market_item_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'market_reviews',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reviewer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seller_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('source', sa.String(20), server_default='app'),
        sa.Column('status', sa.String(20), server_default='completed'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_unique_constraint('unique_review_per_item', 'market_reviews', ['reviewer_id', 'item_id'])
    op.create_index('ix_market_reviews_seller_id', 'market_reviews', ['seller_id'])
    op.create_index('ix_market_reviews_item_id', 'market_reviews', ['item_id'])


def downgrade() -> None:
    op.drop_index('ix_market_reviews_item_id', 'market_reviews')
    op.drop_index('ix_market_reviews_seller_id', 'market_reviews')
    op.drop_constraint('unique_review_per_item', 'market_reviews', type_='unique')
    op.drop_table('market_reviews')
