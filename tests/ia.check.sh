#!/usr/bin/env bash
# Crédits IA (S4) : un Postgres 17 jetable dans Docker, la migration appliquée par-dessus un faux schéma « auth »,
# puis les tests Deno. Rien ne touche la vraie base Supabase ni un fournisseur d'IA.
set -euo pipefail
cd "$(dirname "$0")/.."
name=renzvi-ia-test-$$
docker network create "$name" >/dev/null
docker run -d --rm --name "$name" --network "$name" -e POSTGRES_PASSWORD=test postgres:17 >/dev/null
trap 'docker stop "$name" >/dev/null; docker network rm "$name" >/dev/null' EXIT
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres <<'SQL'
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to authenticated;
grant select on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
SQL
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres < supabase/migrations/20261109000300_ia_credits.sql
docker run --rm --network "$name" -v "$PWD:/app" -w /app -e DB_URL="postgres://postgres:test@$name:5432/postgres" -e DENO_DIR=/app/.deno-cache denoland/deno:2.1.4 test -A tests/ia.test.ts
