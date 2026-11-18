// Edge Function `cuentas`: alta y administración de las cuentas (una por cliente que
// contrata el sistema). Solo la plataforma (`usuarios.plataforma`), o sea el dueño del sistema.
//   GET                                                           → cuentas con usuarios activos y titular
//   POST  { nombre, titular: { email, nombre, apellido, password? }, modulos?, max_usuarios?, prueba? }
//                                                                 → crea la cuenta y su administrador titular
//                                                                   (con prueba: true vence a los 3 días y se corta sola)
//   PATCH { id, nombre?, activa?, modulos?, max_usuarios? }       → cambia plan, cupo o estado (suspender)
//   PATCH { id, prueba: "iniciar" | "extender" | "cortar" | "convertir", dias? }
//                                                                 → controla la prueba gratis de la cuenta
//   PATCH { id, usuario_id, password }                            → restablece la clave de un administrador de la cuenta
// Las cuentas no se eliminan: se suspenden (sus usuarios dejan de ver y escribir datos).
// Una prueba vencida bloquea la cuenta igual que una suspendida: lo hace la base (privado.cuenta_vigente).
// El titular después crea a sus trabajadores desde «Usuarios», dentro de los módulos de su cuenta.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Modulo =
  | "panel"
  | "clientes"
  | "importacion"
  | "oportunidades"
  | "pedidos"
  | "actividades"
  | "productos"
  | "ventas"
  | "landings"
  | "etiquetas"
  | "auditoria"
  | "asistente"
  | "asistente_altas";

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
  /** Hasta cuándo dura la prueba gratis; null = cuenta sin prueba. No viene si la migración 20261118110000 falta. */
  prueba_hasta?: string | null;
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
  "importacion",
  "oportunidades",
  "pedidos",
  "actividades",
  "productos",
  "ventas",
  "landings",
  "etiquetas",
  "auditoria",
  "asistente",
  "asistente_altas",
];
// Todas las columnas: así `prueba_hasta` viene apenas existe y, si la migración todavía no se aplicó,
// la lista de cuentas sigue funcionando en vez de romperse por una columna que falta.
const COLUMNAS_CUENTA = "*";
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
  // Módulos que no sirven sin otro (el complemento y su principal)
  const requiere: [Modulo, Modulo, string][] = [
    ["asistente_altas", "asistente", "Asistente: altas requiere el módulo Asistente"],
    ["importacion", "clientes", "Carga masiva requiere el módulo Clientes"],
  ];
  for (const [complemento, principal, mensaje] of requiere) {
    if (valor.includes(complemento) && !valor.includes(principal)) {
      throw new HttpError(400, mensaje, "invalid_modules");
    }
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

// <prueba-gratis> Reglas puras de la prueba: las prueba scripts/probar-prueba.mjs, que extrae este
// bloque entre las marcas. No uses nada de afuera (ni HttpError ni los tipos de este archivo).
const DIAS_DE_PRUEBA = 3;
const MAX_DIAS_PRUEBA = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

type AccionPrueba = "iniciar" | "extender" | "cortar" | "convertir";
const ACCIONES_PRUEBA: readonly AccionPrueba[] = ["iniciar", "extender", "cortar", "convertir"];

type ResultadoPrueba =
  | { ok: true; hasta: string | null | undefined }
  | { ok: false; estado: number; mensaje: string; codigo: string };

const rechazo = (estado: number, mensaje: string, codigo: string): ResultadoPrueba => ({
  ok: false,
  estado,
  mensaje,
  codigo,
});

/**
 * El nuevo `prueba_hasta` que pide una acción sobre la prueba (`hasta` undefined = sin cambio,
 * null = sin prueba).
 *   iniciar:   pone en prueba una cuenta que no la tiene (desde ahora)
 *   extender:  suma días (desde el vencimiento si todavía no pasó; si ya pasó, desde ahora)
 *   cortar:    la termina ahora: queda bloqueada hasta que se la extienda o se pase a paga
 *   convertir: quita la prueba (cuenta paga, sin vencimiento)
 * Cada acción exige el estado que le corresponde, para que un clic de más no ponga en prueba
 * (ni corte) a una cuenta paga: para bloquear una cuenta paga está «suspender».
 */
const calcularPrueba = (
  esCuentaDeLaPlataforma: boolean,
  hastaActual: string | null | undefined,
  accion: unknown,
  dias: unknown,
  ahora: number = Date.now(),
): ResultadoPrueba => {
  if (accion === undefined) return { ok: true, hasta: undefined };
  if (typeof accion !== "string" || !(ACCIONES_PRUEBA as readonly string[]).includes(accion)) {
    return rechazo(400, "Acción de prueba inválida", "invalid_trial_action");
  }
  // La cuenta de la plataforma no entra en prueba: el dueño se quedaría sin acceso
  if (esCuentaDeLaPlataforma) {
    return rechazo(403, "La cuenta de la plataforma no tiene prueba", "self_change");
  }
  let cantidad = DIAS_DE_PRUEBA;
  if (dias !== undefined) {
    if (typeof dias !== "number" || !Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_PRUEBA) {
      return rechazo(400, `Los días de prueba deben ser un entero de 1 a ${MAX_DIAS_PRUEBA}`, "invalid_days");
    }
    cantidad = dias;
  }
  const hasta = hastaActual ? Date.parse(hastaActual) : null;
  const sumar = (base: number) => new Date(base + cantidad * MS_POR_DIA).toISOString();
  switch (accion as AccionPrueba) {
    case "iniciar":
      return hasta !== null
        ? rechazo(409, "La cuenta ya tiene una prueba: usá «extender»", "trial_exists")
        : { ok: true, hasta: sumar(ahora) };
    case "extender":
      return hasta === null
        ? rechazo(409, "La cuenta no tiene una prueba para extender", "no_trial")
        : { ok: true, hasta: sumar(Math.max(ahora, hasta)) };
    case "cortar":
      if (hasta === null) {
        return rechazo(409, "La cuenta no tiene prueba: para bloquearla, suspendela", "no_trial");
      }
      // Si ya terminó no hay nada que cortar
      return { ok: true, hasta: hasta <= ahora ? undefined : new Date(ahora).toISOString() };
    case "convertir":
      return hasta === null
        ? rechazo(409, "La cuenta ya es paga: no tiene prueba", "no_trial")
        : { ok: true, hasta: null };
  }
};
// </prueba-gratis>

const claveAleatoria = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * Un error de Auth se muestra con un mensaje propio: el original (en inglés y con
 * detalles del proveedor) queda solo en el registro del servidor.
 */
const mensajeAuth = (
  error: { code?: string } | null | undefined,
  porDefecto: string,
): string => {
  switch (error?.code) {
    case "weak_password":
      return "La contraseña no cumple los requisitos de seguridad";
    case "email_address_invalid":
    case "validation_failed":
      return "Revisá el email y la contraseña: no son válidos";
    default:
      return porDefecto;
  }
};

/**
 * El titular recibió una contraseña provisoria: el CRM lo obliga a elegir una propia
 * al ingresar. Si todavía no se aplicó la migración que agrega la columna, se deja
 * constancia en el registro y se sigue: no es motivo para frenar la operación.
 */
const marcarCambioDeClave = async (usuarioId: string) => {
  const { error } = await admin.from("usuarios").update({ debe_cambiar_clave: true }).eq("id", usuarioId);
  if (error) console.error("cuentas.marcar_cambio_clave_fallido", { usuarioId, error });
};

/** Nivel de verificación (`aal1` o `aal2`) que trae el token. Ya se validó con `getUser`: acá solo se lee. */
const nivelDelToken = (token: string): string | null => {
  try {
    const carga = token.split(".")[1] ?? "";
    const json = atob(carga.replace(/-/g, "+").replace(/_/g, "/"));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
};

/**
 * Quien administra todas las cuentas es la llave maestra del sistema: si activó la
 * verificación en dos pasos (app de autenticación), la sesión tiene que haberla
 * confirmado (aal2). Con la variable MFA_PLATAFORMA=exigir, además la tiene que haber
 * activado. Sin esa variable y sin factor activado no se pide nada (así nadie queda
 * afuera antes de configurarla).
 * Si no se puede leer la lista de factores, con MFA_PLATAFORMA=exigir se frena (503);
 * sin ella se deja pasar y se deja constancia en el registro: una falla de lectura no
 * puede dejar al dueño del sistema sin acceso a Cuentas mientras el control es opcional.
 */
const exigirSegundoPaso = async (userId: string, token: string) => {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) {
    console.error("cuentas.mfa_lectura_fallida", error);
    if (Deno.env.get("MFA_PLATAFORMA") !== "exigir") return;
    throw new HttpError(503, "No se pudo verificar la autenticación en dos pasos", "mfa_check_failed");
  }
  const activa = (data?.factors ?? []).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
  if (activa) {
    if (nivelDelToken(token) !== "aal2") {
      throw new HttpError(
        403,
        "Confirmá tu identidad con el código de tu aplicación de autenticación",
        "mfa_required",
      );
    }
    return;
  }
  if (Deno.env.get("MFA_PLATAFORMA") === "exigir") {
    throw new HttpError(
      403,
      "Activá la verificación en dos pasos desde «Mi perfil» para administrar cuentas",
      "mfa_enroll_required",
    );
  }
};

/** Verifica el JWT del llamador, que sea de la plataforma y, si corresponde, su segundo paso. */
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
  await exigirSegundoPaso(auth.user.id, token);
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
  // Sin indicar módulos, la cuenta nueva lleva todo menos el asistente (es un extra del plan)
  const modulos =
    body.modulos === undefined
      ? MODULOS.filter((modulo) => modulo !== "asistente" && modulo !== "asistente_altas")
      : leerModulos(body.modulos);
  const maximo = body.max_usuarios === undefined ? null : leerMaximo(body.max_usuarios);
  if (body.prueba !== undefined && typeof body.prueba !== "boolean") {
    throw new HttpError(400, "El campo prueba debe ser verdadero o falso", "invalid_trial");
  }
  const prueba = body.prueba === true;

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
    if (!duplicado) console.error("cuentas.alta_usuario_fallida", authError);
    throw new HttpError(
      duplicado ? 409 : 400,
      duplicado ? "Ya existe un usuario con ese email" : mensajeAuth(authError, "No se pudo crear el usuario"),
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
    // Solo con prueba se manda el argumento: sin ella el alta no depende de la migración de la prueba
    ...(prueba ? { p_prueba_dias: DIAS_DE_PRUEBA } : {}),
  });
  const cuenta = alta as Cuenta | null;
  if (altaError || !cuenta) {
    await admin.auth.admin.deleteUser(usuarioId);
    const repetida = altaError?.code === "23505" && (altaError.message ?? "").includes("cuentas_nombre");
    // PGRST202: la base no conoce la función con ese argumento (falta la migración de la prueba gratis)
    const sinPrueba = prueba && altaError?.code === "PGRST202";
    if (!repetida) console.error("cuentas.alta_fallida", altaError);
    throw new HttpError(
      repetida ? 409 : 500,
      repetida
        ? "Ya existe una cuenta con ese nombre"
        : sinPrueba
          ? "La base todavía no tiene la prueba gratis: falta aplicar la migración 20261118110000"
          : "No se pudo crear la cuenta",
      repetida ? "name_taken" : sinPrueba ? "trial_not_supported" : "create_failed",
    );
  }

  await marcarCambioDeClave(usuarioId);
  await auditar(actor, cuenta, "crear", {
    nombre,
    modulos,
    max_usuarios: maximo,
    titular: email,
    ...(prueba ? { prueba_hasta: cuenta.prueba_hasta ?? null } : {}),
  });
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
  await marcarCambioDeClave(usuario.id);
  await auditar(actor, cuenta, "restablecer_clave", { usuario_id: usuario.id });
  return cuenta;
};

const actualizarCuenta = async (actor: Plataforma, body: Record<string, unknown>) => {
  const actual = await cargarCuenta(body.id);
  if (body.usuario_id !== undefined) return await restablecerClave(actor, actual, body);

  const cambios: Partial<Pick<Cuenta, "nombre" | "activa" | "modulos" | "max_usuarios" | "prueba_hasta">> = {};

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
  const prueba = calcularPrueba(actual.id === actor.cuenta_id, actual.prueba_hasta, body.prueba, body.dias);
  if (!prueba.ok) throw new HttpError(prueba.estado, prueba.mensaje, prueba.codigo);
  if (prueba.hasta !== undefined) cambios.prueba_hasta = prueba.hasta;

  if (Object.keys(cambios).length === 0) return actual;

  const { data: nueva, error } = await admin
    .from("cuentas")
    .update({ ...cambios, actualizada_en: new Date().toISOString() })
    .eq("id", actual.id)
    .select(COLUMNAS_CUENTA)
    .single<Cuenta>();
  if (error || !nueva) {
    const repetida = error?.code === "23505";
    // 42703 / PGRST204: la columna no existe todavía (falta la migración de la prueba gratis)
    const sinPrueba = error?.code === "42703" || error?.code === "PGRST204";
    if (!repetida) console.error("cuentas.update_fallido", error);
    throw new HttpError(
      repetida ? 409 : 500,
      repetida
        ? "Ya existe una cuenta con ese nombre"
        : sinPrueba && cambios.prueba_hasta !== undefined
          ? "La base todavía no tiene la prueba gratis: falta aplicar la migración 20261118110000"
          : "No se pudo actualizar la cuenta",
      repetida ? "name_taken" : sinPrueba ? "trial_not_supported" : "update_failed",
    );
  }

  // Estado aparte; el resto de los cambios en un solo registro de edición
  const editados: Record<string, { antes: unknown; despues: unknown }> = {};
  if (cambios.nombre !== undefined) editados.nombre = { antes: actual.nombre, despues: cambios.nombre };
  if (cambios.modulos !== undefined) editados.modulos = { antes: actual.modulos, despues: cambios.modulos };
  if (cambios.max_usuarios !== undefined) {
    editados.max_usuarios = { antes: actual.max_usuarios, despues: cambios.max_usuarios };
  }
  if (cambios.prueba_hasta !== undefined) {
    editados.prueba_hasta = { antes: actual.prueba_hasta ?? null, despues: cambios.prueba_hasta };
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
