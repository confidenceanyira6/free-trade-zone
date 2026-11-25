-- Run this in the Supabase SQL editor of the project (pzwuarejywtnkyereufc) BEFORE applying migrations.
-- Read-only. Send me the output (or fix conflicts yourself): migrations 0001-0003 assume the tables
-- below either do not exist or have the columns the migrations use.

select table_name, string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;

select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;

select schemaname, tablename, policyname, cmd from pg_policies where schemaname in ('public','storage') order by 1, 2, 3;

select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1;

select id, public from storage.buckets order by 1;
