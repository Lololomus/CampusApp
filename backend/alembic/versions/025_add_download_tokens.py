"""Add download tokens.

Revision ID: 025_add_download_tokens
Revises: 024_add_media_processing_jobs
Create Date: 2026-05-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "025_add_download_tokens"
down_revision: Union[str, None] = "024_add_media_processing_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "download_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["post_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(op.f("ix_download_tokens_id"), "download_tokens", ["id"], unique=False)
    op.create_index(op.f("ix_download_tokens_token"), "download_tokens", ["token"], unique=True)
    op.create_index(op.f("ix_download_tokens_document_id"), "download_tokens", ["document_id"], unique=False)
    op.create_index(op.f("ix_download_tokens_user_id"), "download_tokens", ["user_id"], unique=False)
    op.create_index(op.f("ix_download_tokens_expires_at"), "download_tokens", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_download_tokens_expires_at"), table_name="download_tokens")
    op.drop_index(op.f("ix_download_tokens_user_id"), table_name="download_tokens")
    op.drop_index(op.f("ix_download_tokens_document_id"), table_name="download_tokens")
    op.drop_index(op.f("ix_download_tokens_token"), table_name="download_tokens")
    op.drop_index(op.f("ix_download_tokens_id"), table_name="download_tokens")
    op.drop_table("download_tokens")
