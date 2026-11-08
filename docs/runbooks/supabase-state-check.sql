-- Supabase production state check: READ-ONLY.
--
-- Run in Supabase › SQL Editor and paste back the result tables.
-- Every statement only reads catalog metadata or counts rows. Nothing is created,
-- changed or deleted, and no row contents, emails, hashes or secrets are returned.
--
-- Purpose (Phase 2 prerequisite): decide whether V2 migrations 0001/0002 are applied,
-- and which PostgreSQL major version local Docker and CI must match.

-- 1. PostgreSQL version --------------------------------------------------------
select current_setting('server_version')                as server_version,
       current_setting('server_version_num')::int / 10000 as major_version;

-- 2. Alembic migration state (V2 head is '0002' if both migrations ran) ---------
select case
         when to_regclass('public.alembic_version') is null then 'no alembic_version table (V2 migrations never ran)'
         else (xpath('/row/version_num/text()',
                     query_to_xml('select string_agg(version_num, '','') as version_num from public.alembic_version',
                                  false, true, '')))[1]::text
       end as alembic_version;

-- 3. Tables in the public schema with exact row counts and RLS status ----------
select c.relname                                                         as table_name,
       (xpath('/row/n/text()',
              query_to_xml(format('select count(*) as n from public.%I', c.relname),
                           false, true, '')))[1]::text::bigint           as row_count,
       c.relrowsecurity                                                  as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 4. Storage buckets (names and visibility only) -------------------------------
select id as bucket, public, created_at::date as created
from storage.buckets
order by id;

-- 5. Objects per bucket (counts only) ------------------------------------------
select bucket_id as bucket, count(*) as objects
from storage.objects
group by bucket_id
order by bucket_id;
