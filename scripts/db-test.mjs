// Prueba las migraciones y el test de aislamiento en un Postgres LOCAL y descartable
// (PGlite: Postgres compilado a WASM). No toca ninguna base remota ni necesita .env.scripts.
//
//   npm run db:test                      aplica supabase/migrations y corre supabase/tests/aislamiento_cuentas.sql
//   npm run db:test -- otra_prueba.sql   corre otro archivo de prueba (debe terminar en un select 'aislamiento_ok')
//
// Emula lo mínimo de Supabase: los roles anon / authenticated / service_role, auth.uid(),
// storage.buckets / storage.objects y los privilegios por defecto del esquema public. Es una
// emulación: no reemplaza correr el mismo archivo contra una base real de Supabase
// (npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento_cuentas.sql).
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const raiz = join(import.meta.dirname, "..");
const carpetaMigraciones = join(raiz, "supabase", "migrations");
const archivoPrueba = process.argv[2]
  ? resolve(process.argv[2])
  : join(raiz, "supabase", "tests", "aislamiento_cuentas.sql");

const ENTORNO_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (
    instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz,
    confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
    raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(), updated_at timestamptz default now(), banned_until timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), ''), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
    name text, owner uuid, created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
  grant select on auth.users to service_role;
  -- Lo que Supabase deja configurado para el rol postgres en el esquema public
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
`;

const db = new PGlite({ extensions: { unaccent } });

const fallar = (cual, error) => {
  console.error(`✗ ${cual}`);
  console.error(`  ${error.message}`);
  for (const campo of ["detail", "hint", "where", "code"]) {
    if (error[campo]) console.error(`  ${campo}: ${error[campo]}`);
  }
  process.exit(1);
};

const ejecutar = async (cual, sql) => {
  try {
    return await db.exec(sql);
  } catch (error) {
    return fallar(cual, error);
  }
};

const inicio = Date.now();
await ejecutar("entorno de Supabase", ENTORNO_SUPABASE);

const migraciones = readdirSync(carpetaMigraciones)
  .filter((nombre) => nombre.endsWith(".sql"))
  .sort();
for (const nombre of migraciones) {
  await ejecutar(`migración ${nombre}`, readFileSync(join(carpetaMigraciones, nombre), "utf8"));
}
console.log(`✓ ${migraciones.length} migraciones aplicadas`);

const resultados = await ejecutar(`prueba ${archivoPrueba}`, readFileSync(archivoPrueba, "utf8"));
const termino = resultados.some((resultado) =>
  resultado.rows?.some((fila) => fila.resultado === "aislamiento_ok"),
);
if (!termino) {
  console.error(`✗ ${archivoPrueba} no terminó en «aislamiento_ok»`);
  process.exit(1);
}
console.log(`✓ aislamiento_ok (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
await db.close();
