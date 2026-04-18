"""add contact request approvals

Revision ID: 018_add_contact_requests
Revises: 017_add_help_post_type
Create Date: 2026-04-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "018_add_contact_requests"
down_revision: Union[str, Sequence[str], None] = "017_add_help_post_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contact_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("related_type", sa.String(length=30), nullable=True),
        sa.Column("related_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("requester_contact", sa.String(length=255), nullable=True),
        sa.Column("owner_contact", sa.String(length=255), nullable=True),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contact_requests_id"), "contact_requests", ["id"], unique=False)
    op.create_index(op.f("ix_contact_requests_source_type"), "contact_requests", ["source_type"], unique=False)
    op.create_index(op.f("ix_contact_requests_source_id"), "contact_requests", ["source_id"], unique=False)
    op.create_index(op.f("ix_contact_requests_owner_id"), "contact_requests", ["owner_id"], unique=False)
    op.create_index(op.f("ix_contact_requests_requester_id"), "contact_requests", ["requester_id"], unique=False)
    op.create_index(op.f("ix_contact_requests_decided_by"), "contact_requests", ["decided_by"], unique=False)
    op.create_index(op.f("ix_contact_requests_status"), "contact_requests", ["status"], unique=False)
    op.create_index(op.f("ix_contact_requests_created_at"), "contact_requests", ["created_at"], unique=False)
    op.create_index(
        "ix_contact_requests_owner_status_created",
        "contact_requests",
        ["owner_id", "status", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_contact_requests_requester_status_created",
        "contact_requests",
        ["requester_id", "status", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_contact_requests_source_requester",
        "contact_requests",
        ["source_type", "source_id", "requester_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_contact_requests_source_requester", table_name="contact_requests")
    op.drop_index("ix_contact_requests_requester_status_created", table_name="contact_requests")
    op.drop_index("ix_contact_requests_owner_status_created", table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_created_at"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_status"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_decided_by"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_requester_id"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_owner_id"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_source_id"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_source_type"), table_name="contact_requests")
    op.drop_index(op.f("ix_contact_requests_id"), table_name="contact_requests")
    op.drop_table("contact_requests")
