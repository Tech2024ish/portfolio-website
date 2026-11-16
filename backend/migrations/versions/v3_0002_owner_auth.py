"""The owner account and its sign-in sessions.

Both tables are reached only by the API (as the table owner), never by Supabase client roles:
like v3_0001, the migration enables row-level security without policies and revokes the
default ``anon`` and ``authenticated`` grants wherever those roles exist. This matters most
here: without it, Supabase's public anon key could read password hashes through its REST API.

No row is inserted. The owner account is created with ``python -m app.cli.owner``, which
also imports a V2 password hash if one has to be carried over.

Revision ID: v3_0002
Revises: v3_0001
Create Date: 2026-11-16
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "v3_0002"
down_revision: str | Sequence[str] | None = "v3_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("owner_users", "owner_sessions")


def upgrade() -> None:
    op.create_table(
        "owner_users",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("display_name", sa.String(120), server_default="Owner", nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "password_changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("email = lower(email)", name=op.f("ck_owner_users_email_lowercase")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_owner_users")),
        sa.UniqueConstraint("email", name=op.f("uq_owner_users_email")),
    )

    op.create_table(
        "owner_sessions",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(300), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["owner_users.id"],
            name=op.f("fk_owner_sessions_user_id_owner_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_owner_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_owner_sessions_token_hash")),
    )
    op.create_index(op.f("ix_owner_sessions_user_id"), "owner_sessions", ["user_id"])

    for table in _TABLES:
        op.execute(f"alter table {table} enable row level security")
    op.execute(
        """
        do $$
        declare r text; t text;
        begin
          foreach r in array array['anon', 'authenticated'] loop
            if exists (select 1 from pg_roles where rolname = r) then
              foreach t in array array['owner_users', 'owner_sessions'] loop
                execute format('revoke all on table %I from %I', t, r);
                execute format(
                  'revoke all on sequence %s from %I', pg_get_serial_sequence(t, 'id'), r
                );
              end loop;
            end if;
          end loop;
        end $$;
        """
    )


def downgrade() -> None:
    # Deletes the owner account and every session. Never run against production without a
    # verified backup and a plan to recreate the owner.
    op.drop_index(op.f("ix_owner_sessions_user_id"), table_name="owner_sessions")
    op.drop_table("owner_sessions")
    op.drop_table("owner_users")
