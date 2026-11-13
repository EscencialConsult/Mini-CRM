// Crea el primer administrador (o cualquier usuario) sin pasar por la app.
//   node scripts/crear-admin.mjs <email> <nombre> <apellido> [clave] [rol] [cuenta_id]
// Sin cuenta_id el usuario va a la cuenta principal, pero solo mientras exista una sola
// cuenta: con varias hay que indicar a cuál pertenece.
// Si no se pasa clave, genera una y la imprime. Usa la secret key de .env.scripts.
import { randomBytes } from "node:crypto";
import { loadScriptEnv } from "./env.mjs";

const [email, nombre, apellido, claveArg, rol = "administrador", cuentaArg] = process.argv.slice(2);
if (!email || !nombre || !apellido) {
  console.error("Uso: node scripts/crear-admin.mjs <email> <nombre> <apellido> [clave] [rol] [cuenta_id]");
  process.exit(1);
}

const env = loadScriptEnv();
const clave = claveArg ?? randomBytes(12).toString("base64url");
const headers = { apikey: env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" };

const authResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    email,
    password: clave,
    email_confirm: true,
    user_metadata: { nombre, apellido },
  }),
});
const authBody = await authResponse.json();
if (!authResponse.ok) {
  console.error("Auth:", authBody.msg ?? authBody.message ?? JSON.stringify(authBody));
  process.exit(1);
}

const profileResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/usuarios`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=minimal" },
  body: JSON.stringify({
    id: authBody.id,
    email,
    nombre,
    apellido,
    rol,
    activo: true,
    ...(cuentaArg ? { cuenta_id: Number(cuentaArg) } : {}),
  }),
});
if (!profileResponse.ok) {
  console.error("Perfil:", await profileResponse.text());
  process.exit(1);
}

console.log(JSON.stringify({ id: authBody.id, email, rol, clave }, null, 2));
