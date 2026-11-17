"""Move the V1/V2 tables out of ``public`` into a ``legacy`` schema, without deleting anything.

The production Supabase database (inventory of 2026-11-09) holds tables from the earlier sites:
``contacts`` (13 rows), ``projects`` (3 demo rows), ``visits`` (362 rows) and ``customer``
(empty). V3 creates its own ``projects`` table, so the first V3 migration would fail on the old
one; and every old table grants the Supabase ``anon`` and ``authenticated`` roles every privilege,
including TRUNCATE, which row-level security does not stop.

This revision runs before every other V3 revision. For each old table that exists in ``public``
with its old shape it:

- moves the table (rows, identity/serial sequence, indexes, policies) to the ``legacy`` schema;
- revokes all privileges on it and its sequence from ``anon``, ``authenticated`` and ``PUBLIC``.

The ``legacy`` schema itself grants nothing to those roles, and Supabase does not expose it
through its API. Nothing is deleted or rewritten: the data stays readable by the database owner,
for ``python -m app.cli.production legacy-report`` and ``import-legacy-contacts``. On a database
without old tables (development, tests) this revision does nothing.

Downgrade moves the tables back to ``public`` (without restoring the old open grants) and drops
the ``legacy`` schema when it is empty.

Revision ID: v3_0000
Revises:
Create Date: 2026-11-17
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "v3_0000"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Table name -> SQL condition (on information_schema.columns of public.<table>) that identifies
# the old table. V3 never uses contacts, visits, customer or visit_stats; projects and skills are
# V3 names too, so they are moved only when they have the old columns.
_LEGACY = {
    "contacts": "true",
    "visits": "true",
    "customer": "true",
    "visit_stats": "true",
    "projects": "bool_or(column_name = 'tech_stack') and not bool_or(column_name = 'slug')",
    "skills": "bool_or(column_name = 'level') and not bool_or(column_name = 'category_id')",
}


def upgrade() -> None:
    for table, condition in _LEGACY.items():
        # Literal SQL: table names come from the fixed mapping above.
        op.execute(
            f"""
            do $$
            declare seq text;
            begin
              if exists (
                select 1 from information_schema.columns
                where table_schema = 'public' and table_name = '{table}'
                group by table_name having {condition}
              ) then
                create schema if not exists legacy;
                revoke all on schema legacy from public;
                alter table public.{table} set schema legacy;
                revoke all on table legacy.{table} from public;
                if exists (select 1 from pg_roles where rolname = 'anon') then
                  execute 'revoke all on table legacy.{table} from anon';
                end if;
                if exists (select 1 from pg_roles where rolname = 'authenticated') then
                  execute 'revoke all on table legacy.{table} from authenticated';
                end if;
                for seq in
                  select s.relname from pg_class s
                  join pg_depend d on d.objid = s.oid and d.deptype in ('a', 'i')
                  join pg_class t on t.oid = d.refobjid
                  join pg_namespace n on n.oid = t.relnamespace
                  where s.relkind = 'S' and n.nspname = 'legacy' and t.relname = '{table}'
                loop
                  execute format('revoke all on sequence legacy.%I from public', seq);
                  if exists (select 1 from pg_roles where rolname = 'anon') then
                    execute format('revoke all on sequence legacy.%I from anon', seq);
                  end if;
                  if exists (select 1 from pg_roles where rolname = 'authenticated') then
                    execute format('revoke all on sequence legacy.%I from authenticated', seq);
                  end if;
                end loop;
              end if;
            end $$;
            """  # noqa: S608 - fixed table names
        )


def downgrade() -> None:
    for table in _LEGACY:
        op.execute(
            f"""
            do $$
            begin
              if to_regclass('legacy.{table}') is not null
                 and to_regclass('public.{table}') is null then
                alter table legacy.{table} set schema public;
              end if;
            end $$;
            """
        )
    op.execute(
        """
        do $$
        begin
          if exists (select 1 from pg_namespace where nspname = 'legacy')
             and not exists (
               select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'legacy'
             ) then
            drop schema legacy;
          end if;
        end $$;
        """
    )
