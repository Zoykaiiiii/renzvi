#!/usr/bin/env bash
# Règles d'accès (RLS) entre deux comptes : un Postgres 17 jetable dans Docker, de faux schémas « auth » et « storage »,
# toutes les migrations, puis tests/rls.check.sql. Rien ne touche la vraie base Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
name=renzvi-rls-test-$$
docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=test postgres:17 >/dev/null
trap 'docker stop "$name" >/dev/null' EXIT
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1
psql() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres "$@"; }
psql <<'SQL'
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, aud text, role text, email text, email_confirmed_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
-- Comme Supabase : toute nouvelle fonction est exécutable par anon et authenticated, sauf révocation explicite.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
SQL
for f in supabase/migrations/*.sql; do psql < "$f"; done
out=$(psql < tests/rls.check.sql 2>&1 || true)
echo "$out" | tr '|' '\n'
grep -q 'RAPPORT OK' <<<"$out"
