// Edge Function `users`: gestión de usuarios del Mini-CRM. Solo administradores activos.
//   POST  { email, password, nombre, apellido, rol, modulos? }                → crea el usuario
//   PATCH { id, nombre?, apellido?, rol?, activo?, password?, modulos? }       → actualiza datos, rol, estado, clave o módulos
// Cada administrador gestiona SOLO a los usuarios de su cuenta, con los módulos que su cuenta tiene
// y hasta su máximo de usuarios activos. Una cuenta suspendida no gestiona nada.
// Los usuarios no se eliminan: se desactivan (conserva el historial de autoría).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Rol = "administrador" | "vendedor";
type Modulo =
  | "panel"
  | "clientes"
  | "oportunidades"
  | "pedidos"
  | "actividades"
  | "productos"
  | "ventas"
  | "landings"
  | "etiquetas"
  | "auditoria";

interface PerfilUsuario {
  id: string;
  cuenta_id: number;
  /** Dueño del sistema: solo otro usuario de la plataforma puede modificarlo. */
  plataforma: boolean;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  activo: boolean;
  modulos: Modulo[];
  sistema: boolean;
}

interface CuentaActor {
  id: number;
  activa: boolean;
  modulos: Modulo[];
  max_usuarios: number | null;
}

type Actor = PerfilUsuario & { cuenta: CuentaActor };

type AccionAuditoria =
  | "crear"
  | "editar"
  | "cambiar_rol"
  | "activar"
  | "desactivar"
  | "restablecer_clave";

const ROLES: readonly Rol[] = ["administrador", "vendedor"];
// Mismo orden que el CHECK usuarios_modulos_validos y el menú del CRM
const MODULOS: readonly Modulo[] = [
  "panel",
  "clientes",
  "oportunidades",
  "pedidos",
  "actividades",
  "productos",
  "ventas",
  "landings",
  "etiquetas",
  "auditoria",
];
const MODULOS_POR_DEFECTO: readonly Modulo[] = ["panel", "clientes", "oportunidades", "actividades"];
const COLUMNAS_PERFIL = "id, cuenta_id, plataforma, nombre, apellido, email, rol, activo, modulos, sistema";
const MIN_CLAVE = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAN_PERMANENTE = "876000h";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

const esRol = (valor: unknown): valor is Rol =>
  typeof valor === "string" && (ROLES as readonly string[]).includes(valor);

/** Lista de módulos válida, sin repetidos y en el orden canónico. */
const leerModulos = (valor: unknown): Modulo[] => {
  if (!Array.isArray(valor) || valor.some((modulo) => !(MODULOS as readonly unknown[]).includes(modulo))) {
    throw new HttpError(400, "Módulos inválidos", "invalid_modules");
  }
  return MODULOS.filter((modulo) => valor.includes(modulo));
};

const mismosModulos = (a: readonly Modulo[], b: readonly Modulo[]) =>
  a.length === b.length && a.every((modulo) => b.includes(modulo));

/** Los módulos que se asignan tienen que estar entre los que la cuenta tiene. */
const exigirEnPlan = (modulos: readonly Modulo[], cuenta: CuentaActor) => {
  const fuera = modulos.filter((modulo) => !cuenta.modulos.includes(modulo));
  if (fuera.length > 0) {
    throw new HttpError(403, "Algún módulo no está incluido en el plan de la cuenta", "module_not_in_plan");
  }
};

/** Respeta el máximo de usuarios activos de la cuenta (null = sin límite). */
const exigirCupo = async (cuenta: CuentaActor) => {
  if (cuenta.max_usuarios === null) return;
  const { count } = await admin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuenta.id)
    .eq("activo", true)
    .eq("sistema", false);
  if ((count ?? 0) >= cuenta.max_usuarios) {
    throw new HttpError(
      409,
      `La cuenta llegó a su máximo de ${cuenta.max_usuarios} usuarios activos`,
      "user_limit",
    );
  }
};

const nombreCompleto = (perfil: Pick<PerfilUsuario, "nombre" | "apellido">) =>
  `${perfil.nombre} ${perfil.apellido}`.trim();

/** Verifica el JWT del llamador y que sea un administrador activo. */
const exigirAdministrador = async (req: Request): Promise<Actor> => {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Falta la sesión", "no_session");

  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new HttpError(401, "Sesión inválida", "invalid_session");

  const { data: perfil } = await admin
    .from("usuarios")
    .select(COLUMNAS_PERFIL)
    .eq("id", auth.user.id)
    .maybeSingle<PerfilUsuario>();
  if (!perfil || !perfil.activo || perfil.rol !== "administrador") {
    throw new HttpError(403, "Solo un administrador puede gestionar usuarios", "not_allowed");
  }

  const { data: cuenta } = await admin
    .from("cuentas")
    .select("id, activa, modulos, max_usuarios")
    .eq("id", perfil.cuenta_id)
    .maybeSingle<CuentaActor>();
  if (!cuenta) throw new HttpError(403, "La cuenta no existe", "no_account");
  if (!cuenta.activa) throw new HttpError(403, "La cuenta está suspendida", "account_suspended");
  return { ...perfil, cuenta };
};

const auditar = async (
  actor: Actor,
  objetivo: Pick<PerfilUsuario, "id" | "nombre" | "apellido">,
  accion: AccionAuditoria,
  cambios: Record<string, unknown>,
) => {
  const { error } = await admin.from("auditoria").insert({
    cuenta_id: actor.cuenta_id,
    usuario_id: actor.id,
    entidad: "usuarios",
    registro_id: objetivo.id,
    accion,
    descripcion: nombreCompleto(objetivo),
    cambios,
  });
  // Un fallo de auditoría se informa pero no deshace un cambio ya hecho
  if (error) console.error("users.auditoria_fallida", { accion, objetivo: objetivo.id, error });
};

const crearUsuario = async (actor: Actor, body: Record<string, unknown>) => {
  const email = texto(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const nombre = texto(body.nombre);
  const apellido = texto(body.apellido);
  const rol = body.rol ?? "vendedor";
  const modulos = body.modulos === undefined ? [...MODULOS_POR_DEFECTO] : leerModulos(body.modulos);

  if (!EMAIL_REGEX.test(email)) throw new HttpError(400, "Email inválido", "invalid_email");
  if (password.length < MIN_CLAVE) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`, "weak_password");
  }
  if (!nombre || !apellido) throw new HttpError(400, "Nombre y apellido son obligatorios", "invalid_name");
  if (!esRol(rol)) throw new HttpError(400, "Rol inválido", "invalid_role");
  exigirEnPlan(modulos, actor.cuenta);
  await exigirCupo(actor.cuenta);

  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido },
  });
  if (authError || !creado.user) {
    const duplicado = authError?.code === "email_exists";
    throw new HttpError(
      duplicado ? 409 : 400,
      duplicado ? "Ya existe un usuario con ese email" : (authError?.message ?? "No se pudo crear el usuario"),
      duplicado ? "email_taken" : "create_failed",
    );
  }

  const perfil = { id: creado.user.id, cuenta_id: actor.cuenta_id, email, nombre, apellido, rol, activo: true, modulos };
  const { error: perfilError } = await admin.from("usuarios").insert(perfil);
  if (perfilError) {
    // Sin perfil el usuario no podría operar: se revierte el alta en Auth
    await admin.auth.admin.deleteUser(creado.user.id);
    console.error("users.perfil_fallido", perfilError);
    throw new HttpError(500, "No se pudo crear el perfil del usuario", "profile_failed");
  }

  await auditar(actor, perfil, "crear", { email, rol, modulos });
  return perfil;
};

const actualizarUsuario = async (actor: Actor, body: Record<string, unknown>) => {
  const id = texto(body.id);
  if (!id) throw new HttpError(400, "Falta el id del usuario", "missing_id");

  const { data: actual } = await admin
    .from("usuarios")
    .select(COLUMNAS_PERFIL)
    .eq("id", id)
    .maybeSingle<PerfilUsuario>();
  // Un usuario de otra cuenta se trata como inexistente: no se revela que existe
  if (!actual || actual.cuenta_id !== actor.cuenta_id) {
    throw new HttpError(404, "Usuario no encontrado", "not_found");
  }
  // El usuario del sistema (Bot WhatsApp) no se toca: ni datos, ni clave, ni estado
  if (actual.sistema) throw new HttpError(403, "Es un usuario del sistema: no se modifica", "system_user");
  // El usuario de la plataforma (el dueño del sistema) solo lo modifica otro usuario de la plataforma:
  // si no, cualquier otro administrador de la cuenta principal podría quedarse con ella cambiándole
  // la clave, el rol o el estado, y desde ahí ver las demás cuentas.
  if (actual.plataforma && !actor.plataforma) {
    throw new HttpError(403, "Es un usuario de la plataforma: no se modifica desde acá", "platform_user");
  }

  const esUnoMismo = actual.id === actor.id;
  const cambios: Partial<Pick<PerfilUsuario, "nombre" | "apellido" | "rol" | "activo" | "modulos">> = {};

  if (body.nombre !== undefined) {
    const nombre = texto(body.nombre);
    if (!nombre) throw new HttpError(400, "El nombre no puede estar vacío", "invalid_name");
    if (nombre !== actual.nombre) cambios.nombre = nombre;
  }
  if (body.apellido !== undefined) {
    const apellido = texto(body.apellido);
    if (!apellido) throw new HttpError(400, "El apellido no puede estar vacío", "invalid_name");
    if (apellido !== actual.apellido) cambios.apellido = apellido;
  }
  if (body.rol !== undefined && body.rol !== actual.rol) {
    if (!esRol(body.rol)) throw new HttpError(400, "Rol inválido", "invalid_role");
    if (esUnoMismo) throw new HttpError(403, "No podés cambiar tu propio rol", "self_change");
    cambios.rol = body.rol;
  }
  if (body.activo !== undefined && body.activo !== actual.activo) {
    if (typeof body.activo !== "boolean") throw new HttpError(400, "Estado inválido", "invalid_state");
    if (esUnoMismo) throw new HttpError(403, "No podés desactivar tu propia cuenta", "self_change");
    if (body.activo) await exigirCupo(actor.cuenta);
    cambios.activo = body.activo;
  }
  if (body.modulos !== undefined) {
    const modulos = leerModulos(body.modulos);
    exigirEnPlan(modulos, actor.cuenta);
    if (!mismosModulos(modulos, actual.modulos)) cambios.modulos = modulos;
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (body.password !== undefined && password.length < MIN_CLAVE) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`, "weak_password");
  }

  if (Object.keys(cambios).length > 0) {
    // El trigger usuarios_proteger impide dejar al sistema sin administradores
    const { error } = await admin.from("usuarios").update(cambios).eq("id", id);
    if (error) {
      const sinAdmin = error.message.includes("al menos un administrador");
      throw new HttpError(sinAdmin ? 409 : 500, sinAdmin ? error.message : "No se pudo actualizar el usuario", "update_failed");
    }
  }

  const cambiosAuth: { password?: string; ban_duration?: string; user_metadata?: Record<string, string> } = {};
  if (password) cambiosAuth.password = password;
  if (cambios.activo !== undefined) cambiosAuth.ban_duration = cambios.activo ? "none" : BAN_PERMANENTE;
  if (cambios.nombre !== undefined || cambios.apellido !== undefined) {
    cambiosAuth.user_metadata = {
      nombre: cambios.nombre ?? actual.nombre,
      apellido: cambios.apellido ?? actual.apellido,
    };
  }
  if (Object.keys(cambiosAuth).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, cambiosAuth);
    if (error) {
      // El perfil ya cambió: se revierte para no dejar Auth y perfil desalineados
      if (Object.keys(cambios).length > 0) {
        await admin.from("usuarios").update({
          nombre: actual.nombre,
          apellido: actual.apellido,
          rol: actual.rol,
          activo: actual.activo,
          modulos: actual.modulos,
        }).eq("id", id);
      }
      console.error("users.auth_fallido", error);
      throw new HttpError(500, "No se pudo actualizar la cuenta de acceso", "auth_update_failed");
    }
  }

  // Nombre, apellido y módulos van en un solo registro de edición
  const editados: Record<string, { antes: unknown; despues: unknown }> = {};
  if (cambios.nombre !== undefined || cambios.apellido !== undefined) {
    editados.nombre = { antes: actual.nombre, despues: cambios.nombre ?? actual.nombre };
    editados.apellido = { antes: actual.apellido, despues: cambios.apellido ?? actual.apellido };
  }
  if (cambios.modulos !== undefined) {
    editados.modulos = { antes: actual.modulos, despues: cambios.modulos };
  }
  if (Object.keys(editados).length > 0) await auditar(actor, actual, "editar", editados);
  if (cambios.rol !== undefined) {
    await auditar(actor, actual, "cambiar_rol", { rol: { antes: actual.rol, despues: cambios.rol } });
  }
  if (cambios.activo !== undefined) {
    await auditar(actor, actual, cambios.activo ? "activar" : "desactivar", {});
  }
  if (password) await auditar(actor, actual, "restablecer_clave", {});

  return { ...actual, ...cambios };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const actor = await exigirAdministrador(req);
    if (req.method !== "POST" && req.method !== "PATCH") {
      throw new HttpError(405, "Método no permitido", "method_not_allowed");
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Cuerpo inválido", "invalid_body");

    const data = req.method === "POST"
      ? await crearUsuario(actor, body)
      : await actualizarUsuario(actor, body);
    return respond(req.method === "POST" ? 201 : 200, { data });
  } catch (error) {
    if (error instanceof HttpError) {
      return respond(error.status, { message: error.message, code: error.code });
    }
    console.error("users.error_inesperado", error);
    return respond(500, { message: "Error interno del servidor", code: "internal_error" });
  }
});
