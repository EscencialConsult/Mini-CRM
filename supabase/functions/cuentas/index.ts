// Edge Function `cuentas`: alta y administración de las cuentas (una por cliente que
// contrata el sistema). Solo la plataforma (`usuarios.plataforma`), o sea el dueño del sistema.
//   GET                                                           → cuentas con usuarios activos y titular
//   POST  { nombre, titular: { email, nombre, apellido, password? }, modulos?, max_usuarios? }
//                                                                 → crea la cuenta y su administrador titular
//   PATCH { id, nombre?, activa?, modulos?, max_usuarios? }       → cambia plan, cupo o estado (suspender)
//   PATCH { id, usuario_id, password }                            → restablece la clave de un administrador de la cuenta
// Las cuentas no se eliminan: se suspenden (sus usuarios dejan de ver y escribir datos).
// El titular después crea a sus trabajadores desde «Usuarios», dentro de los módulos de su cuenta.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

interface Plataforma {
  id: string;
  cuenta_id: number;
  nombre: string;
  apellido: string;
}

interface Cuenta {
  id: number;
  nombre: string;
  activa: boolean;
  max_usuarios: number | null;
  modulos: Modulo[];
  creada_en: string;
  actualizada_en: string;
}

interface UsuarioResumen {
  id: string;
  cuenta_id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  activo: boolean;
  creado_en: string;
}

type AccionAuditoria = "crear" | "editar" | "activar" | "desactivar" | "restablecer_clave";

// Mismo orden que el CHECK cuentas_modulos_validos y el menú del CRM
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
const COLUMNAS_CUENTA = "id, nombre, activa, max_usuarios, modulos, creada_en, actualizada_en";
const MIN_CLAVE = 8;
const MAX_NOMBRE = 80;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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

const leerModulos = (valor: unknown): Modulo[] => {
  if (!Array.isArray(valor) || valor.some((modulo) => !(MODULOS as readonly unknown[]).includes(modulo))) {
    throw new HttpError(400, "Módulos inválidos", "invalid_modules");
  }
  return MODULOS.filter((modulo) => valor.includes(modulo));
};

const leerMaximo = (valor: unknown): number | null => {
  if (valor === null) return null;
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 1 || valor > 100000) {
    throw new HttpError(400, "El máximo de usuarios debe ser un entero de 1 en adelante, o vacío", "invalid_max");
  }
  return valor;
};

const leerNombre = (valor: unknown): string => {
  const nombre = texto(valor).replace(/\s+/g, " ");
  if (!nombre || nombre.length > MAX_NOMBRE) {
    throw new HttpError(400, `El nombre de la cuenta es obligatorio (hasta ${MAX_NOMBRE} caracteres)`, "invalid_name");
  }
  return nombre;
};

const mismosModulos = (a: readonly Modulo[], b: readonly Modulo[]) =>
  a.length === b.length && a.every((modulo) => b.includes(modulo));

const claveAleatoria = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Verifica el JWT del llamador y que sea de la plataforma. */
const exigirPlataforma = async (req: Request): Promise<Plataforma> => {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Falta la sesión", "no_session");

  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new HttpError(401, "Sesión inválida", "invalid_session");

  const { data: perfil } = await admin
    .from("usuarios")
    .select("id, cuenta_id, nombre, apellido, activo, plataforma")
    .eq("id", auth.user.id)
    .maybeSingle<Plataforma & { activo: boolean; plataforma: boolean }>();
  if (!perfil || !perfil.activo || !perfil.plataforma) {
    throw new HttpError(403, "Solo la plataforma puede administrar cuentas", "not_allowed");
  }
  return perfil;
};

const auditar = async (
  actor: Plataforma,
  cuenta: Pick<Cuenta, "id" | "nombre">,
  accion: AccionAuditoria,
  cambios: Record<string, unknown>,
) => {
  const { error } = await admin.from("auditoria").insert({
    cuenta_id: cuenta.id,
    usuario_id: actor.id,
    entidad: "cuentas",
    registro_id: String(cuenta.id),
    accion,
    descripcion: cuenta.nombre,
    cambios,
    origen: "Plataforma",
  });
  // Un fallo de auditoría se informa pero no deshace un cambio ya hecho
  if (error) console.error("cuentas.auditoria_fallida", { accion, cuenta: cuenta.id, error });
};

const cargarCuenta = async (id: unknown): Promise<Cuenta> => {
  if (typeof id !== "number" || !Number.isInteger(id)) {
    throw new HttpError(400, "Falta el id de la cuenta", "missing_id");
  }
  const { data } = await admin.from("cuentas").select(COLUMNAS_CUENTA).eq("id", id).maybeSingle<Cuenta>();
  if (!data) throw new HttpError(404, "Cuenta no encontrada", "not_found");
  return data;
};

const usuariosActivos = async (cuentaId: number): Promise<number> => {
  const { count } = await admin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .eq("activo", true)
    .eq("sistema", false);
  return count ?? 0;
};

/** Todos los usuarios (sin el del sistema), de a páginas: la API devuelve hasta 1000 filas por pedido. */
const todosLosUsuarios = async (): Promise<UsuarioResumen[]> => {
  const filas: UsuarioResumen[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin
      .from("usuarios")
      .select("id, cuenta_id, nombre, apellido, email, rol, activo, creado_en")
      .eq("sistema", false)
      .order("creado_en")
      .order("id")
      .range(desde, desde + 999)
      .returns<UsuarioResumen[]>();
    if (error) throw new HttpError(500, "No se pudieron leer los usuarios", "list_failed");
    filas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return filas;
  }
};

const listarCuentas = async () => {
  const [{ data: cuentas, error }, usuarios] = await Promise.all([
    admin.from("cuentas").select(COLUMNAS_CUENTA).order("id").returns<Cuenta[]>(),
    todosLosUsuarios(),
  ]);
  if (error) throw new HttpError(500, "No se pudieron leer las cuentas", "list_failed");

  return (cuentas ?? []).map((cuenta) => {
    const propios = usuarios.filter((usuario) => usuario.cuenta_id === cuenta.id);
    const titular = propios.find((usuario) => usuario.rol === "administrador") ?? null;
    return {
      ...cuenta,
      usuarios_activos: propios.filter((usuario) => usuario.activo).length,
      titular: titular
        ? { id: titular.id, nombre: titular.nombre, apellido: titular.apellido, email: titular.email }
        : null,
    };
  });
};

const crearCuenta = async (actor: Plataforma, body: Record<string, unknown>) => {
  const nombre = leerNombre(body.nombre);
  const modulos = body.modulos === undefined ? [...MODULOS] : leerModulos(body.modulos);
  const maximo = body.max_usuarios === undefined ? null : leerMaximo(body.max_usuarios);

  const titular = (body.titular ?? {}) as Record<string, unknown>;
  const email = texto(titular.email).toLowerCase();
  const nombreTitular = texto(titular.nombre);
  const apellidoTitular = texto(titular.apellido);
  const clavePropia = typeof titular.password === "string" ? titular.password : "";
  if (!EMAIL_REGEX.test(email)) throw new HttpError(400, "Email del titular inválido", "invalid_email");
  if (!nombreTitular || !apellidoTitular) {
    throw new HttpError(400, "Nombre y apellido del titular son obligatorios", "invalid_name");
  }
  if (clavePropia && clavePropia.length < MIN_CLAVE) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`, "weak_password");
  }
  const clave = clavePropia || claveAleatoria();

  // 1) Cuenta de acceso del titular
  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email,
    password: clave,
    email_confirm: true,
    user_metadata: { nombre: nombreTitular, apellido: apellidoTitular },
  });
  if (authError || !creado.user) {
    const duplicado = authError?.code === "email_exists";
    throw new HttpError(
      duplicado ? 409 : 400,
      duplicado ? "Ya existe un usuario con ese email" : (authError?.message ?? "No se pudo crear el usuario"),
      duplicado ? "email_taken" : "create_failed",
    );
  }
  const usuarioId = creado.user.id;

  // 2) La cuenta, sus canales de sistema y el perfil del titular, en UNA transacción de la
  // base: si algo falla no queda nada a medias y solo hay que borrar la cuenta de acceso.
  const { data: alta, error: altaError } = await admin.rpc("cuenta_alta", {
    p_nombre: nombre,
    p_modulos: modulos,
    p_max_usuarios: maximo,
    p_usuario: usuarioId,
    p_email: email,
    p_nombre_titular: nombreTitular,
    p_apellido_titular: apellidoTitular,
  });
  const cuenta = alta as Cuenta | null;
  if (altaError || !cuenta) {
    await admin.auth.admin.deleteUser(usuarioId);
    const repetida = altaError?.code === "23505" && (altaError.message ?? "").includes("cuentas_nombre");
    if (!repetida) console.error("cuentas.alta_fallida", altaError);
    throw new HttpError(
      repetida ? 409 : 500,
      repetida ? "Ya existe una cuenta con ese nombre" : "No se pudo crear la cuenta",
      repetida ? "name_taken" : "create_failed",
    );
  }

  await auditar(actor, cuenta, "crear", { nombre, modulos, max_usuarios: maximo, titular: email });
  return {
    ...cuenta,
    usuarios_activos: 1,
    titular: { id: usuarioId, nombre: nombreTitular, apellido: apellidoTitular, email },
    // Solo si la generó el sistema: se muestra una vez para entregársela al titular
    clave_inicial: clavePropia ? undefined : clave,
  };
};

const restablecerClave = async (actor: Plataforma, cuenta: Cuenta, body: Record<string, unknown>) => {
  const usuarioId = texto(body.usuario_id);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_CLAVE) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`, "weak_password");
  }
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, cuenta_id, rol, sistema")
    .eq("id", usuarioId)
    .maybeSingle<{ id: string; cuenta_id: number; rol: string; sistema: boolean }>();
  if (!usuario || usuario.cuenta_id !== cuenta.id || usuario.rol !== "administrador" || usuario.sistema) {
    throw new HttpError(404, "Administrador no encontrado en esa cuenta", "not_found");
  }
  const { error } = await admin.auth.admin.updateUserById(usuario.id, { password });
  if (error) {
    console.error("cuentas.clave_fallida", error);
    throw new HttpError(500, "No se pudo cambiar la contraseña", "auth_update_failed");
  }
  await auditar(actor, cuenta, "restablecer_clave", { usuario_id: usuario.id });
  return cuenta;
};

const actualizarCuenta = async (actor: Plataforma, body: Record<string, unknown>) => {
  const actual = await cargarCuenta(body.id);
  if (body.usuario_id !== undefined) return await restablecerClave(actor, actual, body);

  const cambios: Partial<Pick<Cuenta, "nombre" | "activa" | "modulos" | "max_usuarios">> = {};

  if (body.nombre !== undefined) {
    const nombre = leerNombre(body.nombre);
    if (nombre !== actual.nombre) cambios.nombre = nombre;
  }
  if (body.activa !== undefined && body.activa !== actual.activa) {
    if (typeof body.activa !== "boolean") throw new HttpError(400, "Estado inválido", "invalid_state");
    // La cuenta de la plataforma no se suspende: el dueño se quedaría sin acceso
    if (!body.activa && actual.id === actor.cuenta_id) {
      throw new HttpError(403, "No podés suspender tu propia cuenta", "self_change");
    }
    cambios.activa = body.activa;
  }
  if (body.modulos !== undefined) {
    const modulos = leerModulos(body.modulos);
    if (!mismosModulos(modulos, actual.modulos)) cambios.modulos = modulos;
  }
  if (body.max_usuarios !== undefined) {
    const maximo = leerMaximo(body.max_usuarios);
    if (maximo !== actual.max_usuarios) {
      if (maximo !== null) {
        const activos = await usuariosActivos(actual.id);
        if (maximo < activos) {
          throw new HttpError(
            409,
            `La cuenta tiene ${activos} usuarios activos: desactivá alguno antes de bajar el máximo`,
            "max_below_active",
          );
        }
      }
      cambios.max_usuarios = maximo;
    }
  }

  if (Object.keys(cambios).length === 0) return actual;

  const { data: nueva, error } = await admin
    .from("cuentas")
    .update({ ...cambios, actualizada_en: new Date().toISOString() })
    .eq("id", actual.id)
    .select(COLUMNAS_CUENTA)
    .single<Cuenta>();
  if (error || !nueva) {
    const repetida = error?.code === "23505";
    if (!repetida) console.error("cuentas.update_fallido", error);
    throw new HttpError(
      repetida ? 409 : 500,
      repetida ? "Ya existe una cuenta con ese nombre" : "No se pudo actualizar la cuenta",
      repetida ? "name_taken" : "update_failed",
    );
  }

  // Estado aparte; el resto de los cambios en un solo registro de edición
  const editados: Record<string, { antes: unknown; despues: unknown }> = {};
  if (cambios.nombre !== undefined) editados.nombre = { antes: actual.nombre, despues: cambios.nombre };
  if (cambios.modulos !== undefined) editados.modulos = { antes: actual.modulos, despues: cambios.modulos };
  if (cambios.max_usuarios !== undefined) {
    editados.max_usuarios = { antes: actual.max_usuarios, despues: cambios.max_usuarios };
  }
  if (Object.keys(editados).length > 0) await auditar(actor, nueva, "editar", editados);
  if (cambios.activa !== undefined) await auditar(actor, nueva, cambios.activa ? "activar" : "desactivar", {});

  return nueva;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const actor = await exigirPlataforma(req);

    if (req.method === "GET") return respond(200, { data: await listarCuentas() });
    if (req.method !== "POST" && req.method !== "PATCH") {
      throw new HttpError(405, "Método no permitido", "method_not_allowed");
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Cuerpo inválido", "invalid_body");

    const data = req.method === "POST" ? await crearCuenta(actor, body) : await actualizarCuenta(actor, body);
    return respond(req.method === "POST" ? 201 : 200, { data });
  } catch (error) {
    if (error instanceof HttpError) {
      return respond(error.status, { message: error.message, code: error.code });
    }
    console.error("cuentas.error_inesperado", error);
    return respond(500, { message: "Error interno del servidor", code: "internal_error" });
  }
});
