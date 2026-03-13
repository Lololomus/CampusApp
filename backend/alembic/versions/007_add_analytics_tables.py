"""add analytics events and daily metrics tables

Revision ID: 007_add_analytics_tables
Revises: 006_notif_inbox_fields
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '007_add_analytics_tables'
down_revision = '006_notif_inbox_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if 'analytics_events' not in table_names:
        op.create_table(
            'analytics_events',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('event_name', sa.String(length=100), nullable=False),
            sa.Column('event_ts_utc', sa.DateTime(), nullable=False),
            sa.Column('event_date_msk', sa.Date(), nullable=False),
            sa.Column('user_hash', sa.String(length=64), nullable=False),
            sa.Column('session_id', sa.String(length=128), nullable=True),
            sa.Column('platform', sa.String(length=32), nullable=True),
            sa.Column('app_version', sa.String(length=32), nullable=True),
            sa.Column('screen', sa.String(length=64), nullable=True),
            sa.Column('entity_type', sa.String(length=64), nullable=True),
            sa.Column('entity_id', sa.Integer(), nullable=True),
            sa.Column('properties_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column('ingest_source', sa.String(length=16), nullable=False, server_default='client'),
            sa.Column('request_id', sa.String(length=128), nullable=False),
            sa.Column('dedup_key', sa.String(length=255), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('dedup_key', name='uq_analytics_event_dedup_key'),
        )

    if 'analytics_daily_metrics' not in table_names:
        op.create_table(
            'analytics_daily_metrics',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('date_msk', sa.Date(), nullable=False),
            sa.Column('slice_name', sa.String(length=32), nullable=False),
            sa.Column('metric_key', sa.String(length=128), nullable=False),
            sa.Column('dimension_key', sa.String(length=128), nullable=False, server_default='all'),
            sa.Column('value_num', sa.Float(), nullable=False, server_default='0'),
            sa.Column('numerator', sa.Float(), nullable=True),
            sa.Column('denominator', sa.Float(), nullable=True),
            sa.Column('pct_value', sa.Float(), nullable=True),
            sa.Column('calc_status', sa.String(length=32), nullable=False, server_default='ok'),
            sa.Column('computed_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('date_msk', 'slice_name', 'metric_key', 'dimension_key', name='uq_analytics_daily_metric'),
        )

    inspector = sa.inspect(bind)

    def _create_index_if_missing(index_name: str, table_name: str, columns: list[str]) -> None:
        existing = {idx['name'] for idx in inspector.get_indexes(table_name)}
        if index_name not in existing:
            op.create_index(index_name, table_name, columns)

    _create_index_if_missing('ix_analytics_events_event_name', 'analytics_events', ['event_name'])
    _create_index_if_missing('ix_analytics_events_event_ts_utc', 'analytics_events', ['event_ts_utc'])
    _create_index_if_missing('ix_analytics_events_event_date_msk', 'analytics_events', ['event_date_msk'])
    _create_index_if_missing('ix_analytics_events_user_hash', 'analytics_events', ['user_hash'])
    _create_index_if_missing('ix_analytics_events_session_id', 'analytics_events', ['session_id'])
    _create_index_if_missing('ix_analytics_events_created_at', 'analytics_events', ['created_at'])
    _create_index_if_missing('ix_analytics_event_date_name', 'analytics_events', ['event_date_msk', 'event_name'])
    _create_index_if_missing('ix_analytics_event_user_date', 'analytics_events', ['user_hash', 'event_date_msk'])

    _create_index_if_missing('ix_analytics_daily_metrics_date_msk', 'analytics_daily_metrics', ['date_msk'])
    _create_index_if_missing('ix_analytics_daily_metrics_slice_name', 'analytics_daily_metrics', ['slice_name'])
    _create_index_if_missing('ix_analytics_daily_metrics_metric_key', 'analytics_daily_metrics', ['metric_key'])
    _create_index_if_missing('ix_analytics_daily_metrics_dimension_key', 'analytics_daily_metrics', ['dimension_key'])
    _create_index_if_missing('ix_analytics_daily_metrics_computed_at', 'analytics_daily_metrics', ['computed_at'])
    _create_index_if_missing('ix_analytics_daily_slice_date', 'analytics_daily_metrics', ['slice_name', 'date_msk'])


def downgrade() -> None:
    op.drop_index('ix_analytics_daily_slice_date', table_name='analytics_daily_metrics')
    op.drop_index('ix_analytics_daily_metrics_computed_at', table_name='analytics_daily_metrics')
    op.drop_index('ix_analytics_daily_metrics_dimension_key', table_name='analytics_daily_metrics')
    op.drop_index('ix_analytics_daily_metrics_metric_key', table_name='analytics_daily_metrics')
    op.drop_index('ix_analytics_daily_metrics_slice_name', table_name='analytics_daily_metrics')
    op.drop_index('ix_analytics_daily_metrics_date_msk', table_name='analytics_daily_metrics')

    op.drop_index('ix_analytics_event_user_date', table_name='analytics_events')
    op.drop_index('ix_analytics_event_date_name', table_name='analytics_events')
    op.drop_index('ix_analytics_events_created_at', table_name='analytics_events')
    op.drop_index('ix_analytics_events_session_id', table_name='analytics_events')
    op.drop_index('ix_analytics_events_user_hash', table_name='analytics_events')
    op.drop_index('ix_analytics_events_event_date_msk', table_name='analytics_events')
    op.drop_index('ix_analytics_events_event_ts_utc', table_name='analytics_events')
    op.drop_index('ix_analytics_events_event_name', table_name='analytics_events')

    op.drop_table('analytics_daily_metrics')
    op.drop_table('analytics_events')
