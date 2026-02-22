"""Phase 1 model/schema migration: indexes, nullable, JSONB columns.

Revision ID: 002_phase1_model_schema
Revises: 001_phase0_hotfixes
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "002_phase1_model_schema"
down_revision: Union[str, None] = "001_phase0_hotfixes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_composite_indexes() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_post_author_deleted ON posts (author_id, is_deleted);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_post_category_deleted_created ON posts (category, is_deleted, created_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_request_author_status ON requests (author_id, status);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_request_status_expires ON requests (status, expires_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_market_seller_status ON market_items (seller_id, status);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_market_status_deleted_created ON market_items (status, is_deleted, created_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_comment_post_created ON comments (post_id, created_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_dating_like_whom ON dating_likes (whom_liked_id, is_like);"
    )


def _make_market_institute_nullable() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'market_items'
                  AND column_name = 'institute'
                  AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE market_items ALTER COLUMN institute DROP NOT NULL;
            END IF;
        END$$;
        """
    )


def _create_jsonb_helper() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION _campusapp_safe_jsonb(input_text text, fallback jsonb)
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF input_text IS NULL OR btrim(input_text) = '' THEN
                RETURN fallback;
            END IF;
            RETURN input_text::jsonb;
        EXCEPTION
            WHEN others THEN
                RETURN fallback;
        END;
        $$;
        """
    )


def _drop_jsonb_helper() -> None:
    op.execute("DROP FUNCTION IF EXISTS _campusapp_safe_jsonb(text, jsonb);")


def _convert_json_columns_to_jsonb() -> None:
    list_columns = (
        ("posts", "tags"),
        ("posts", "images"),
        ("users", "interests"),
        ("datingprofiles", "goals"),
        ("datingprofiles", "photos"),
        ("datingprofiles", "lifestyle"),
        ("polls", "options"),
        ("poll_votes", "option_indices"),
        ("requests", "tags"),
        ("requests", "images"),
        ("market_items", "images"),
    )

    for table_name, column_name in list_columns:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = '{table_name}'
                      AND column_name = '{column_name}'
                ) AND (
                    SELECT data_type
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = '{table_name}'
                      AND column_name = '{column_name}'
                ) <> 'jsonb' THEN
                    ALTER TABLE {table_name}
                    ALTER COLUMN {column_name} TYPE JSONB
                    USING _campusapp_safe_jsonb({column_name}, '[]'::jsonb);
                END IF;
            END$$;
            """
        )

    # prompts is optional dict/null; keep NULL for empty/invalid payloads.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'datingprofiles'
                  AND column_name = 'prompts'
            ) AND (
                SELECT data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'datingprofiles'
                  AND column_name = 'prompts'
            ) <> 'jsonb' THEN
                ALTER TABLE datingprofiles
                ALTER COLUMN prompts TYPE JSONB
                USING _campusapp_safe_jsonb(prompts, NULL::jsonb);
            END IF;
        END$$;
        """
    )


def upgrade() -> None:
    _create_composite_indexes()
    _make_market_institute_nullable()
    _create_jsonb_helper()
    _convert_json_columns_to_jsonb()
    _drop_jsonb_helper()


def downgrade() -> None:
    raise RuntimeError(
        "Irreversible migration: JSON coercion to JSONB may lose original invalid text payloads."
    )

