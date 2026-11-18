"""Remove the id sequences that the single-row tables never use.

``profile`` and ``site_settings`` hold one row with the fixed id 1, but their small-integer primary
keys were created as ``SMALLSERIAL``, which adds a sequence. Nothing uses those sequences, and on
Supabase the default privileges give ``anon`` and ``authenticated`` access to them. Removing them
closes that access. No table row changes.

Revision ID: v3_0007
Revises: v3_0006
Create Date: 2026-11-18 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "v3_0007"
down_revision: str | Sequence[str] | None = "v3_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SINGLE_ROW_TABLES = ("profile", "site_settings")


def upgrade() -> None:
    for table in SINGLE_ROW_TABLES:
        # The column default depends on the sequence, so it has to go first.
        op.execute(f"alter table {table} alter column id drop default")
        op.execute(f"drop sequence if exists {table}_id_seq")


def downgrade() -> None:
    for table in SINGLE_ROW_TABLES:
        sequence = f"{table}_id_seq"
        op.execute(f"create sequence {sequence} as smallint owned by {table}.id")
        op.execute(f"alter table {table} alter column id set default nextval('{sequence}')")
    # Supabase's default privileges apply to the new sequences: keep them closed.
    op.execute(
        """
        do $$
        declare r text; t text;
        begin
          foreach r in array array['anon', 'authenticated'] loop
            if exists (select 1 from pg_roles where rolname = r) then
              foreach t in array array['profile_id_seq', 'site_settings_id_seq'] loop
                execute format('revoke all on sequence %I from %I', t, r);
              end loop;
            end if;
          end loop;
        end $$;
        """
    )
