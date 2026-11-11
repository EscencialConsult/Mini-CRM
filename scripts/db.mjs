// Aplica las migraciones de supabase/migrations a la base remota con psql y las registra
// en supabase_migrations.schema_migrations (mismo formato que la CLI de Supabase).
//   node scripts/db.mjs push            aplica las pendientes
//   node scripts/db.mjs psql -c "..."   ejecuta psql con la conexión del proyecto
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv, rootDir } from "./env.mjs";

const env = loadScriptEnv();
const windowsPsql = "C:/Program Files/PostgreSQL/18/bin/psql.exe";
const psqlBin = existsSync(windowsPsql) ? windowsPsql : "psql";

const connection = [
  "-h", env.SUPABASE_DB_HOST,
  "-p", env.SUPABASE_DB_PORT,
  "-U", env.SUPABASE_DB_USER,
  "-d", "postgres",
];
const childEnv = { ...process.env, PGPASSWORD: env.SUPABASE_DB_PASSWORD, PGSSLMODE: "require" };

const psql = (args, input) =>
  spawnSync(psqlBin, [...connection, "-v", "ON_ERROR_STOP=1", ...args], {
    env: childEnv,
    input,
    encoding: "utf8",
  });

const fail = (result) => {
  process.stderr.write(result.stderr || String(result.error));
  process.exit(result.status || 1);
};

const [command, ...rest] = process.argv.slice(2);

if (command === "psql") {
  const result = spawnSync(psqlBin, [...connection, ...rest], { env: childEnv, stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (command === "push") {
  const setup = psql(["-q", "-c", `
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text not null primary key, statements text[], name text
    );`]);
  if (setup.status) fail(setup);

  const applied = psql(["-tA", "-c", "select version from supabase_migrations.schema_migrations"]);
  if (applied.status) fail(applied);
  const done = new Set(applied.stdout.split(/\r?\n/).filter(Boolean));

  const dir = join(rootDir, "supabase", "migrations");
  const pending = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .filter((f) => !done.has(f.split("_")[0]));
  if (!pending.length) {
    console.log("Base al día: no hay migraciones pendientes.");
    process.exit(0);
  }

  for (const file of pending) {
    const [version, ...nameParts] = file.replace(/\.sql$/, "").split("_");
    const sql = readFileSync(join(dir, file), "utf8");
    const record = `insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${nameParts.join("_")}', array[$mig$${sql}$mig$]);`;
    const result = psql(["-q", "-1"], `${sql}\n${record}\n`);
    if (result.status) {
      console.error(`✗ ${file}`);
      fail(result);
    }
    console.log(`✓ ${file}`);
  }
  process.exit(0);
}

console.error("Uso: node scripts/db.mjs push | psql [args de psql]");
process.exit(1);
