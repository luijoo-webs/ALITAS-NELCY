// Postgres real (PGlite, WASM) con un "mini Supabase": esquemas auth/storage, roles
// anon/authenticated y auth.uid(). Permite probar migraciones y RLS sin Docker.
// shortcut: los stubs imitan lo esencial de Supabase; antes de producción, correr también
// `supabase db reset` contra un proyecto real o local (ver docs/02-configuracion.md).
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id), name text, owner uuid
  );
  alter table storage.objects enable row level security;
  create publication supabase_realtime;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  -- Igual que Supabase: privilegios por defecto amplios; RLS decide.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated;
`

export async function createDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
    } catch (e) {
      throw new Error(`Migración ${file} falló: ${(e as Error).message}`)
    }
  }
  return db
}

export type Db = Awaited<ReturnType<typeof createDb>>

/** Crea un usuario en auth.users (como hace Supabase Auth). */
export async function createUser(db: Db, email: string, opts: { confirmed?: boolean; meta?: object } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, $3) returning id`,
    [email, opts.confirmed === false ? null : new Date().toISOString(), JSON.stringify(opts.meta ?? {})],
  )
  return rows[0].id
}

export async function grantRole(db: Db, userId: string, roleCode: string) {
  await asAdmin(db)
  await db.query(
    `insert into public.user_roles (user_id, role_id) select $1, id from public.roles where code = $2`,
    [userId, roleCode],
  )
}

/** Ejecuta como el dueño de la base (equivale al SQL Editor / service role). */
export async function asAdmin(db: Db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
}

export async function asAnon(db: Db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)
}

export async function asUser(db: Db, userId: string) {
  await db.exec(`reset role; set role authenticated;`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId])
}
