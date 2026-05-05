"""add post event type

Revision ID: 021_add_post_event_type
Revises: 020_show_tg_id_default_true
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa


revision = "021_add_post_event_type"
down_revision = "020_show_tg_id_default_true"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("posts")}

    if "event_type" not in columns:
        op.add_column(
            "posts",
            sa.Column("event_type", sa.String(length=20), nullable=False, server_default="community"),
        )

    indexes = {index["name"] for index in inspector.get_indexes("posts")}
    if "ix_posts_event_type" not in indexes:
        op.create_index("ix_posts_event_type", "posts", ["event_type"])
    if "ix_posts_category_event_date" not in indexes:
        op.create_index("ix_posts_category_event_date", "posts", ["category", "event_date"])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("posts")}
    if "ix_posts_category_event_date" in indexes:
        op.drop_index("ix_posts_category_event_date", table_name="posts")
    if "ix_posts_event_type" in indexes:
        op.drop_index("ix_posts_event_type", table_name="posts")

    columns = {column["name"] for column in inspector.get_columns("posts")}
    if "event_type" in columns:
        op.drop_column("posts", "event_type")
