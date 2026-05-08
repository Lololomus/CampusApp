"""Add post documents.

Revision ID: 023_add_post_documents
Revises: 022_add_referrals
Create Date: 2026-05-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "023_add_post_documents"
down_revision: Union[str, None] = "022_add_referrals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "post_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("uploader_id", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("preview_pdf_path", sa.String(length=500), nullable=True),
        sa.Column("file_ext", sa.String(length=20), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("scan_status", sa.String(length=20), nullable=False, server_default="clean"),
        sa.Column("preview_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploader_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_post_documents_id"), "post_documents", ["id"], unique=False)
    op.create_index(op.f("ix_post_documents_post_id"), "post_documents", ["post_id"], unique=False)
    op.create_index(op.f("ix_post_documents_uploader_id"), "post_documents", ["uploader_id"], unique=False)
    op.create_index("ix_post_document_post_created", "post_documents", ["post_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_post_document_post_created", table_name="post_documents")
    op.drop_index(op.f("ix_post_documents_uploader_id"), table_name="post_documents")
    op.drop_index(op.f("ix_post_documents_post_id"), table_name="post_documents")
    op.drop_index(op.f("ix_post_documents_id"), table_name="post_documents")
    op.drop_table("post_documents")
