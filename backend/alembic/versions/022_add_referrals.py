"""add referrals

Revision ID: 022_add_referrals
Revises: 021_add_post_event_type
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "022_add_referrals"
down_revision = "021_add_post_event_type"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    user_indexes = {index["name"] for index in inspector.get_indexes("users")}

    if "referral_code" not in user_columns:
        op.add_column("users", sa.Column("referral_code", sa.String(length=32), nullable=True))
    if "ix_users_referral_code" not in user_indexes:
        op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)

    tables = set(inspector.get_table_names())
    if "referrals" not in tables:
        op.create_table(
            "referrals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("inviter_user_id", sa.Integer(), nullable=False),
            sa.Column("invited_user_id", sa.Integer(), nullable=False),
            sa.Column("referral_code_used", sa.String(length=32), nullable=False),
            sa.Column("credited_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint("inviter_user_id <> invited_user_id", name="ck_referrals_not_self"),
            sa.ForeignKeyConstraint(["invited_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["inviter_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("invited_user_id", name="uq_referrals_invited_user_id"),
        )

    inspector = sa.inspect(bind)
    referral_indexes = {index["name"] for index in inspector.get_indexes("referrals")}
    indexes_to_create = (
        ("ix_referrals_id", ["id"], False),
        ("ix_referrals_inviter_user_id", ["inviter_user_id"], False),
        ("ix_referrals_invited_user_id", ["invited_user_id"], False),
        ("ix_referrals_referral_code_used", ["referral_code_used"], False),
        ("ix_referrals_credited_at", ["credited_at"], False),
        ("ix_referrals_inviter_credited", ["inviter_user_id", "credited_at"], False),
    )
    for name, columns, unique in indexes_to_create:
        if name not in referral_indexes:
            op.create_index(name, "referrals", columns, unique=unique)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "referrals" in set(inspector.get_table_names()):
        op.drop_table("referrals")

    inspector = sa.inspect(bind)
    user_indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_referral_code" in user_indexes:
        op.drop_index("ix_users_referral_code", table_name="users")

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "referral_code" in user_columns:
        op.drop_column("users", "referral_code")
