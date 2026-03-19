"""deal flow v2 market schema

Revision ID: 013_deal_flow_v2
Revises: 012_add_market_reviews
Create Date: 2026-03-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "013_deal_flow_v2"
down_revision: Union[str, Sequence[str], None] = "012_add_market_reviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def _has_table(table_name: str) -> bool:
        return sa.inspect(op.get_bind()).has_table(table_name)

    def _has_column(table_name: str, column_name: str) -> bool:
        insp = sa.inspect(op.get_bind())
        return column_name in {c["name"] for c in insp.get_columns(table_name)}

    def _has_index(table_name: str, index_name: str) -> bool:
        insp = sa.inspect(op.get_bind())
        return index_name in {i["name"] for i in insp.get_indexes(table_name)}

    def _has_fk(table_name: str, fk_name: str) -> bool:
        insp = sa.inspect(op.get_bind())
        return fk_name in {f["name"] for f in insp.get_foreign_keys(table_name) if f.get("name")}

    op.execute("ALTER TYPE market_status_enum ADD VALUE IF NOT EXISTS 'reserved'")
    op.execute("ALTER TYPE market_status_enum ADD VALUE IF NOT EXISTS 'paused'")
    op.execute("ALTER TYPE market_status_enum ADD VALUE IF NOT EXISTS 'archived'")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_pause_reason_enum') THEN
                CREATE TYPE market_pause_reason_enum AS ENUM ('manual', 'capacity');
            END IF;
        END$$;
        """
    )

    if not _has_column('market_items', 'capacity'):
        op.add_column('market_items', sa.Column('capacity', sa.Integer(), nullable=False, server_default='3'))
    if not _has_column('market_items', 'pause_reason'):
        op.add_column(
            'market_items',
            sa.Column(
                'pause_reason',
                postgresql.ENUM('manual', 'capacity', name='market_pause_reason_enum', create_type=False),
                nullable=True,
            ),
        )
    op.execute("UPDATE market_items SET capacity = 1 WHERE item_type = 'product'")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_lead_status_enum') THEN
                CREATE TYPE market_lead_status_enum AS ENUM ('active', 'cancelled', 'converted', 'expired', 'rejected');
            END IF;
        END$$;
        """
    )

    if not _has_table('market_leads'):
        op.create_table(
            'market_leads',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('item_id', sa.Integer(), sa.ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('buyer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column(
                'status',
                postgresql.ENUM(
                    'active',
                    'cancelled',
                    'converted',
                    'expired',
                    'rejected',
                    name='market_lead_status_enum',
                    create_type=False,
                ),
                nullable=False,
                server_default='active',
            ),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if not _has_index('market_leads', 'ix_market_leads_item_id'):
        op.create_index('ix_market_leads_item_id', 'market_leads', ['item_id'])
    if not _has_index('market_leads', 'ix_market_leads_buyer_id'):
        op.create_index('ix_market_leads_buyer_id', 'market_leads', ['buyer_id'])
    if not _has_index('market_leads', 'ix_market_leads_status'):
        op.create_index('ix_market_leads_status', 'market_leads', ['status'])
    if not _has_index('market_leads', 'ix_market_leads_item_status_created'):
        op.create_index('ix_market_leads_item_status_created', 'market_leads', ['item_id', 'status', 'created_at'])
    if not _has_index('market_leads', 'uq_market_leads_active_item_buyer'):
        op.create_index(
            'uq_market_leads_active_item_buyer',
            'market_leads',
            ['item_id', 'buyer_id'],
            unique=True,
            postgresql_where=sa.text("status = 'active'"),
        )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_deal_status_enum') THEN
                CREATE TYPE market_deal_status_enum AS ENUM (
                    'selected',
                    'in_progress',
                    'provider_confirmed',
                    'customer_confirmed',
                    'completed',
                    'dispute_open',
                    'cancelled',
                    'expired'
                );
            END IF;
        END$$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_customer_result_enum') THEN
                CREATE TYPE market_customer_result_enum AS ENUM ('received', 'not_received');
            END IF;
        END$$;
        """
    )

    if not _has_table('market_deals'):
        op.create_table(
            'market_deals',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('item_id', sa.Integer(), sa.ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('seller_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('buyer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column(
                'status',
                postgresql.ENUM(
                    'selected',
                    'in_progress',
                    'provider_confirmed',
                    'customer_confirmed',
                    'completed',
                    'dispute_open',
                    'cancelled',
                    'expired',
                    name='market_deal_status_enum',
                    create_type=False,
                ),
                nullable=False,
                server_default='selected',
            ),
            sa.Column(
                'customer_result',
                postgresql.ENUM('received', 'not_received', name='market_customer_result_enum', create_type=False),
                nullable=True,
            ),
            sa.Column('selected_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('provider_confirmed_at', sa.DateTime(), nullable=True),
            sa.Column('customer_confirmed_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('disputed_at', sa.DateTime(), nullable=True),
            sa.Column('cancelled_at', sa.DateTime(), nullable=True),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint('seller_id <> buyer_id', name='check_market_deal_distinct_participants'),
        )
    if not _has_index('market_deals', 'ix_market_deals_item_id'):
        op.create_index('ix_market_deals_item_id', 'market_deals', ['item_id'])
    if not _has_index('market_deals', 'ix_market_deals_seller_id'):
        op.create_index('ix_market_deals_seller_id', 'market_deals', ['seller_id'])
    if not _has_index('market_deals', 'ix_market_deals_buyer_id'):
        op.create_index('ix_market_deals_buyer_id', 'market_deals', ['buyer_id'])
    if not _has_index('market_deals', 'ix_market_deals_status'):
        op.create_index('ix_market_deals_status', 'market_deals', ['status'])
    if not _has_index('market_deals', 'ix_market_deals_created_at'):
        op.create_index('ix_market_deals_created_at', 'market_deals', ['created_at'])
    if not _has_index('market_deals', 'ix_market_deals_item_status'):
        op.create_index('ix_market_deals_item_status', 'market_deals', ['item_id', 'status'])
    if not _has_index('market_deals', 'ix_market_deals_buyer_status'):
        op.create_index('ix_market_deals_buyer_status', 'market_deals', ['buyer_id', 'status'])
    if not _has_index('market_deals', 'ix_market_deals_seller_status'):
        op.create_index('ix_market_deals_seller_status', 'market_deals', ['seller_id', 'status'])

    if not _has_table('market_deal_events'):
        op.create_table(
            'market_deal_events',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('deal_id', sa.Integer(), sa.ForeignKey('market_deals.id', ondelete='CASCADE'), nullable=False),
            sa.Column('item_id', sa.Integer(), sa.ForeignKey('market_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('event_type', sa.String(50), nullable=False),
            sa.Column('from_status', sa.String(30), nullable=True),
            sa.Column('to_status', sa.String(30), nullable=True),
            sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if not _has_index('market_deal_events', 'ix_market_deal_events_deal_id'):
        op.create_index('ix_market_deal_events_deal_id', 'market_deal_events', ['deal_id'])
    if not _has_index('market_deal_events', 'ix_market_deal_events_item_id'):
        op.create_index('ix_market_deal_events_item_id', 'market_deal_events', ['item_id'])
    if not _has_index('market_deal_events', 'ix_market_deal_events_actor_id'):
        op.create_index('ix_market_deal_events_actor_id', 'market_deal_events', ['actor_id'])
    if not _has_index('market_deal_events', 'ix_market_deal_events_event_type'):
        op.create_index('ix_market_deal_events_event_type', 'market_deal_events', ['event_type'])
    if not _has_index('market_deal_events', 'ix_market_deal_events_created_at'):
        op.create_index('ix_market_deal_events_created_at', 'market_deal_events', ['created_at'])
    if not _has_index('market_deal_events', 'ix_market_deal_events_deal_created'):
        op.create_index('ix_market_deal_events_deal_created', 'market_deal_events', ['deal_id', 'created_at'])
    if not _has_index('market_deal_events', 'ix_market_deal_events_item_created'):
        op.create_index('ix_market_deal_events_item_created', 'market_deal_events', ['item_id', 'created_at'])

    if not _has_column('market_reviews', 'deal_id'):
        op.add_column('market_reviews', sa.Column('deal_id', sa.Integer(), nullable=True))
    if not _has_index('market_reviews', 'ix_market_reviews_deal_id'):
        op.create_index('ix_market_reviews_deal_id', 'market_reviews', ['deal_id'])
    if not _has_fk('market_reviews', 'fk_market_reviews_deal_id'):
        op.create_foreign_key(
            'fk_market_reviews_deal_id',
            'market_reviews',
            'market_deals',
            ['deal_id'],
            ['id'],
            ondelete='CASCADE',
        )

    op.execute("ALTER TABLE market_reviews DROP CONSTRAINT IF EXISTS unique_review_per_item")

    if not _has_index('market_reviews', 'uq_market_review_per_deal'):
        op.create_index(
            'uq_market_review_per_deal',
            'market_reviews',
            ['reviewer_id', 'deal_id'],
            unique=True,
            postgresql_where=sa.text('deal_id IS NOT NULL'),
        )
    if not _has_index('market_reviews', 'uq_market_review_legacy_item'):
        op.create_index(
            'uq_market_review_legacy_item',
            'market_reviews',
            ['reviewer_id', 'item_id'],
            unique=True,
            postgresql_where=sa.text('deal_id IS NULL'),
        )


def downgrade() -> None:
    op.drop_index('uq_market_review_legacy_item', table_name='market_reviews')
    op.drop_index('uq_market_review_per_deal', table_name='market_reviews')
    op.drop_constraint('fk_market_reviews_deal_id', 'market_reviews', type_='foreignkey')
    op.drop_index('ix_market_reviews_deal_id', table_name='market_reviews')
    op.drop_column('market_reviews', 'deal_id')
    op.create_unique_constraint('unique_review_per_item', 'market_reviews', ['reviewer_id', 'item_id'])

    op.drop_index('ix_market_deal_events_item_created', table_name='market_deal_events')
    op.drop_index('ix_market_deal_events_deal_created', table_name='market_deal_events')
    op.drop_index('ix_market_deal_events_created_at', table_name='market_deal_events')
    op.drop_index('ix_market_deal_events_event_type', table_name='market_deal_events')
    op.drop_index('ix_market_deal_events_actor_id', table_name='market_deal_events')
    op.drop_index('ix_market_deal_events_item_id', table_name='market_deal_events')
    op.drop_index('ix_market_deal_events_deal_id', table_name='market_deal_events')
    op.drop_table('market_deal_events')

    op.drop_index('ix_market_deals_seller_status', table_name='market_deals')
    op.drop_index('ix_market_deals_buyer_status', table_name='market_deals')
    op.drop_index('ix_market_deals_item_status', table_name='market_deals')
    op.drop_index('ix_market_deals_created_at', table_name='market_deals')
    op.drop_index('ix_market_deals_status', table_name='market_deals')
    op.drop_index('ix_market_deals_buyer_id', table_name='market_deals')
    op.drop_index('ix_market_deals_seller_id', table_name='market_deals')
    op.drop_index('ix_market_deals_item_id', table_name='market_deals')
    op.drop_table('market_deals')

    op.drop_index('uq_market_leads_active_item_buyer', table_name='market_leads')
    op.drop_index('ix_market_leads_item_status_created', table_name='market_leads')
    op.drop_index('ix_market_leads_status', table_name='market_leads')
    op.drop_index('ix_market_leads_buyer_id', table_name='market_leads')
    op.drop_index('ix_market_leads_item_id', table_name='market_leads')
    op.drop_table('market_leads')

    op.drop_column('market_items', 'pause_reason')
    op.drop_column('market_items', 'capacity')

    op.execute("DROP TYPE IF EXISTS market_customer_result_enum")
    op.execute("DROP TYPE IF EXISTS market_deal_status_enum")
    op.execute("DROP TYPE IF EXISTS market_lead_status_enum")
    op.execute("DROP TYPE IF EXISTS market_pause_reason_enum")

    op.execute("UPDATE market_items SET status = 'active' WHERE status IN ('reserved', 'paused', 'archived')")
    op.execute("ALTER TABLE market_items ALTER COLUMN status TYPE text")
    op.execute("CREATE TYPE market_status_enum_old AS ENUM ('active', 'sold')")
    op.execute("ALTER TABLE market_items ALTER COLUMN status TYPE market_status_enum_old USING status::market_status_enum_old")
    op.execute("DROP TYPE market_status_enum")
    op.execute("ALTER TYPE market_status_enum_old RENAME TO market_status_enum")
