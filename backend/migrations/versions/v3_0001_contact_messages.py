"""Contact messages and the rate-limit ledger.

First revision of the V3 history. The Supabase inventory (2026-11-09) found no
``alembic_version`` table and none of the V2 tables, so there are no V2 revisions to carry over.
The legacy ``public.contacts`` table is not touched; importing its rows is a separate,
reviewed data migration.

Supabase grants ``anon`` and ``authenticated`` full privileges on new ``public`` tables by
default. These tables are written only by the API (as the table owner), so the migration
enables row-level security without policies and revokes those grants whenever the roles
exist. Locally the roles do not exist and the revoke is skipped.

The same applies to ``alembic_version``, which Alembic creates in ``public`` before this
revision runs: without this, Supabase's public anon key could read or overwrite the recorded
revision through the REST API. The migration role owns the table, so row-level security
(not forced) does not restrict Alembic itself.

Revision ID: v3_0001
Revises:
Create Date: 2026-11-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Every explicit name below is wrapped in op.f(): it marks the name as final, so the metadata
# naming convention (app/models/base.py) is not applied a second time. Without it the CHECK
# constraints were created as "ck_contact_messages_ck_contact_messages_...".

revision: str = "v3_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("contact_messages", "rate_limit_events")
_VERSION_TABLE = "alembic_version"


def upgrade() -> None:
    op.create_table(
        "contact_messages",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("subject", sa.String(150), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="new", nullable=False),
        sa.CheckConstraint(
            "status in ('new', 'read', 'archived')", name=op.f("ck_contact_messages_status_allowed")
        ),
        sa.CheckConstraint(
            "char_length(message) <= 5000", name=op.f("ck_contact_messages_message_length")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contact_messages")),
    )
    op.create_index(
        op.f("ix_contact_messages_status_created_at"), "contact_messages", ["status", "created_at"]
    )

    op.create_table(
        "rate_limit_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("bucket", sa.String(50), nullable=False),
        sa.Column("client_key", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rate_limit_events")),
    )
    op.create_index(
        op.f("ix_rate_limit_events_bucket_client_key_created_at"),
        "rate_limit_events",
        ["bucket", "client_key", "created_at"],
    )
    op.create_index(
        op.f("ix_rate_limit_events_bucket_created_at"),
        "rate_limit_events",
        ["bucket", "created_at"],
    )

    for table in (*_TABLES, _VERSION_TABLE):
        op.execute(f"alter table {table} enable row level security")
    op.execute(
        """
        do $$
        declare r text; t text;
        begin
          foreach r in array array['anon', 'authenticated'] loop
            if exists (select 1 from pg_roles where rolname = r) then
              foreach t in array array['contact_messages', 'rate_limit_events'] loop
                execute format('revoke all on table %I from %I', t, r);
                execute format(
                  'revoke all on sequence %s from %I', pg_get_serial_sequence(t, 'id'), r
                );
              end loop;
              -- alembic_version has no sequence.
              execute format('revoke all on table alembic_version from %I', r);
            end if;
          end loop;
        end $$;
        """
    )


def downgrade() -> None:
    # Destroys stored messages. Never run against production without a verified backup.
    op.drop_index(op.f("ix_rate_limit_events_bucket_created_at"), table_name="rate_limit_events")
    op.drop_index(
        op.f("ix_rate_limit_events_bucket_client_key_created_at"), table_name="rate_limit_events"
    )
    op.drop_table("rate_limit_events")
    op.drop_index(op.f("ix_contact_messages_status_created_at"), table_name="contact_messages")
    op.drop_table("contact_messages")
