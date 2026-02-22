"""Phase 0 security and integrity hotfixes.

Revision ID: 001_phase0_hotfixes
Revises:
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "001_phase0_hotfixes"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0.1: telegram_id -> BIGINT (safe no-op if already migrated)
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'users'
                  AND column_name = 'telegram_id'
                  AND data_type = 'integer'
            ) THEN
                ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
            END IF;
        END$$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'auth_sessions'
                  AND column_name = 'telegram_id'
                  AND data_type = 'integer'
            ) THEN
                ALTER TABLE auth_sessions ALTER COLUMN telegram_id TYPE BIGINT;
            END IF;
        END$$;
        """
    )

    # 0.4: DatingLike dedup + UniqueConstraint + ON DELETE CASCADE FKs
    op.execute(
        """
        DO $$
        DECLARE
            c RECORD;
        BEGIN
            IF to_regclass('dating_likes') IS NULL THEN
                RETURN;
            END IF;

            -- Remove duplicate like pairs, keeping oldest id.
            DELETE FROM dating_likes a
            USING dating_likes b
            WHERE a.id > b.id
              AND a.who_liked_id = b.who_liked_id
              AND a.whom_liked_id = b.whom_liked_id;

            -- Recreate who_liked FK with CASCADE.
            FOR c IN
                SELECT DISTINCT con.conname
                FROM pg_constraint con
                JOIN pg_class tbl ON tbl.oid = con.conrelid
                JOIN pg_attribute att
                  ON att.attrelid = tbl.oid
                 AND att.attnum = ANY(con.conkey)
                WHERE con.contype = 'f'
                  AND tbl.relname = 'dating_likes'
                  AND att.attname = 'who_liked_id'
            LOOP
                EXECUTE format('ALTER TABLE dating_likes DROP CONSTRAINT %I', c.conname);
            END LOOP;

            -- Recreate whom_liked FK with CASCADE.
            FOR c IN
                SELECT DISTINCT con.conname
                FROM pg_constraint con
                JOIN pg_class tbl ON tbl.oid = con.conrelid
                JOIN pg_attribute att
                  ON att.attrelid = tbl.oid
                 AND att.attnum = ANY(con.conkey)
                WHERE con.contype = 'f'
                  AND tbl.relname = 'dating_likes'
                  AND att.attname = 'whom_liked_id'
            LOOP
                EXECUTE format('ALTER TABLE dating_likes DROP CONSTRAINT %I', c.conname);
            END LOOP;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_dating_likes_who_liked_id_users'
                  AND conrelid = 'dating_likes'::regclass
            ) THEN
                ALTER TABLE dating_likes
                ADD CONSTRAINT fk_dating_likes_who_liked_id_users
                FOREIGN KEY (who_liked_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_dating_likes_whom_liked_id_users'
                  AND conrelid = 'dating_likes'::regclass
            ) THEN
                ALTER TABLE dating_likes
                ADD CONSTRAINT fk_dating_likes_whom_liked_id_users
                FOREIGN KEY (whom_liked_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'unique_dating_like'
                  AND conrelid = 'dating_likes'::regclass
            ) THEN
                ALTER TABLE dating_likes
                ADD CONSTRAINT unique_dating_like
                UNIQUE (who_liked_id, whom_liked_id);
            END IF;
        END$$;
        """
    )

    # 0.5: Remove dead likes table if still present.
    op.execute("DROP TABLE IF EXISTS likes CASCADE;")


def downgrade() -> None:
    raise RuntimeError(
        "Irreversible migration: drops likes table and deduplicates dating_likes."
    )

