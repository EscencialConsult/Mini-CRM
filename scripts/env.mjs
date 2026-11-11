// Lee `.env.scripts` (ignorado por git): secretos de los scripts de administración.
// Nunca se carga en el frontend porque Vite solo lee .env, .env.local y .env.[modo].
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

export const loadScriptEnv = () => {
  const values = {};
  for (const line of readFileSync(join(rootDir, ".env.scripts"), "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  for (const key of ["SUPABASE_URL", "SUPABASE_DB_HOST", "SUPABASE_DB_PORT", "SUPABASE_DB_USER", "SUPABASE_DB_PASSWORD", "SUPABASE_SECRET_KEY"]) {
    if (!values[key]) throw new Error(`Falta ${key} en .env.scripts`);
  }
  return values;
};
