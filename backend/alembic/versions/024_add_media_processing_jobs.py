"""Add media processing jobs.

Revision ID: 024_add_media_processing_jobs
Revises: 023_add_post_documents
Create Date: 2026-05-10 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "024_add_media_processing_jobs"
down_revision: Union[str, None] = "023_add_post_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_processing_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("source_path", sa.String(length=500), nullable=False),
        sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["post_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_media_processing_jobs_id"), "media_processing_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_media_processing_jobs_post_id"), "media_processing_jobs", ["post_id"], unique=False)
    op.create_index(op.f("ix_media_processing_jobs_document_id"), "media_processing_jobs", ["document_id"], unique=False)
    op.create_index(op.f("ix_media_processing_jobs_kind"), "media_processing_jobs", ["kind"], unique=False)
    op.create_index(op.f("ix_media_processing_jobs_status"), "media_processing_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_media_processing_jobs_created_at"), "media_processing_jobs", ["created_at"], unique=False)
    op.create_index(
        "ix_media_jobs_status_kind_created",
        "media_processing_jobs",
        ["status", "kind", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_media_jobs_status_kind_created", table_name="media_processing_jobs")
    op.drop_index(op.f("ix_media_processing_jobs_created_at"), table_name="media_processing_jobs")
    op.drop_index(op.f("ix_media_processing_jobs_status"), table_name="media_processing_jobs")
    op.drop_index(op.f("ix_media_processing_jobs_kind"), table_name="media_processing_jobs")
    op.drop_index(op.f("ix_media_processing_jobs_document_id"), table_name="media_processing_jobs")
    op.drop_index(op.f("ix_media_processing_jobs_post_id"), table_name="media_processing_jobs")
    op.drop_index(op.f("ix_media_processing_jobs_id"), table_name="media_processing_jobs")
    op.drop_table("media_processing_jobs")
