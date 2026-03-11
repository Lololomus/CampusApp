"""add notification inbox fields (is_read, read_at)

Revision ID: 006_notif_inbox_fields
Revises: 005_add_comment_images
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = '006_notif_inbox_fields'
down_revision = '005_add_comment_images'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'notifications',
        sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False)
    )
    op.add_column(
        'notifications',
        sa.Column('read_at', sa.DateTime(), nullable=True)
    )
    op.create_index(
        'ix_notif_recipient_unread',
        'notifications',
        ['recipient_id', 'is_read']
    )


def downgrade():
    op.drop_index('ix_notif_recipient_unread', table_name='notifications')
    op.drop_column('notifications', 'read_at')
    op.drop_column('notifications', 'is_read')
