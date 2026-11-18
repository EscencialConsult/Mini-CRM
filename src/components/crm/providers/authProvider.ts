import { useGetIdentity, type AuthProvider, type UserIdentity } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import { tieneModulo, type Modulo } from "../domain/modulos";
import { cuentaVigente } from "../domain/prueba";
import type { CuentaResumen, Rol, Usuario } from "../domain/types";
import { puedeAcceder } from "./permissions";
import { getSupabaseClient } from "./supabase";

export interface CrmIdentity extends UserIdentity {
  id: string;
  fullName: string;
  email: string;
  rol: Rol;
  modulos: Modulo[];
  /** Dueño del sistema: administra las cuentas. */
  plataforma: boolean;
  /** Su cuenta: plan (módulos y máximo de usuarios) y si está activa. */
  cuenta?: CuentaResumen;
  /** Tiene una contraseña provisoria: no sigue hasta elegir una propia. */
  debeCambiarClave: boolean;
}

// El perfil se vuelve a consultar cada minuto: un cambio de rol o una baja
// no puede depender de una copia vieja del navegador.
const PERFIL_TTL_MS = 60 * 1000;
const COLUMNAS_PERFIL =
  "id, nombre, apellido, email, rol, activo, modulos, creado_en";

// El perfil y la cuenta se leen con las columnas que dejó cada migración, de la
// más nueva a la más vieja. Si el sitio sale antes que una migración, esas
// columnas no existen todavía: se prueba con menos y el CRM sigue con lo que ya
// hay. Que falte sólo la columna más nueva NO puede hacer perder las demás (sin
// cuenta_id y plataforma el dueño del sistema no ve «Cuentas»; sin la cuenta no
// se limita nada por plan ni se muestra que está suspendida o con la prueba vencida).
interface Niveles {
  columnas: readonly string[];
  nivel: number;
  probarDeNuevoEn: number;
}

//   1. 20261118100000 (seguridad): debe_cambiar_clave
//   2. 20261114100000 (cuentas): cuenta_id y plataforma
//   3. ninguna de las dos
const NIVELES_DEL_PERFIL: Niveles = {
  columnas: [
    `${COLUMNAS_PERFIL}, cuenta_id, plataforma, debe_cambiar_clave`,
    `${COLUMNAS_PERFIL}, cuenta_id, plataforma`,
    COLUMNAS_PERFIL,
  ],
  nivel: 0,
  probarDeNuevoEn: 0,
};

//   1. 20261118110000 (prueba gratis): prueba_hasta
//   2. lo de siempre
const COLUMNAS_CUENTA = "id, nombre, activa, modulos, max_usuarios";
const NIVELES_DE_LA_CUENTA: Niveles = {
  columnas: [`${COLUMNAS_CUENTA}, prueba_hasta`, COLUMNAS_CUENTA],
  nivel: 0,
  probarDeNuevoEn: 0,
};

// Cuánto se espera antes de volver a probar con las columnas más nuevas, por si
// la migración se aplicó mientras la pestaña seguía abierta
const REINTENTO_COLUMNAS_MS = 10 * 60 * 1000;

/** ¿Falló porque la columna todavía no existe (y no, por ejemplo, por un corte de red)? */
const faltaColumna = (error: { code?: string; message?: string }): boolean =>
  error.code === "42703" ||
  error.code === "PGRST204" ||
  /column .* does not exist|could not find the .* column/i.test(
    error.message ?? "",
  );

/** Una consulta que recibe las columnas a pedir (lo que devuelve el cliente de Supabase). */
type LecturaDe<T> = (columnas: string) => PromiseLike<{
  data: T | null;
  error: { code?: string; message?: string } | null;
}>;

/**
 * Lee con el nivel de columnas vigente y baja de nivel sólo si falta una columna.
 * Undefined = no se pudo leer (un corte de red o de sesión no baja de nivel: se
 * reintenta en la próxima lectura).
 */
const leerPorNiveles = async <T>(
  niveles: Niveles,
  leer: LecturaDe<T>,
): Promise<{ data: T | null } | undefined> => {
  if (niveles.nivel > 0 && Date.now() >= niveles.probarDeNuevoEn) {
    niveles.nivel = 0;
  }
  while (niveles.nivel < niveles.columnas.length) {
    const lectura = await leer(niveles.columnas[niveles.nivel]);
    if (!lectura.error) return { data: lectura.data };
    if (!faltaColumna(lectura.error)) return undefined;
    niveles.nivel += 1;
    niveles.probarDeNuevoEn = Date.now() + REINTENTO_COLUMNAS_MS;
  }
  return undefined;
};

let perfilEnCache: { perfil: Usuario; leidoEn: number } | null = null;

const leerPerfil = async (): Promise<Usuario | undefined> => {
  const client = getSupabaseClient();
  const { data: sesion } = await client.auth.getSession();
  const userId = sesion.session?.user.id;
  if (!userId) return undefined;

  const lecturaPerfil = await leerPorNiveles(NIVELES_DEL_PERFIL, (columnas) =>
    client
      .from("usuarios")
      .select(columnas)
      .eq("id", userId)
      .maybeSingle<Usuario>(),
  );
  const data = lecturaPerfil?.data;
  if (!data) return undefined;

  // Su cuenta (RLS solo deja leer la propia). Sin ella no se limita nada en la
  // pantalla: la base igual rechaza lo que la cuenta no tiene.
  const cuentaId = data.cuenta_id;
  const lecturaCuenta =
    cuentaId === undefined
      ? undefined
      : await leerPorNiveles(NIVELES_DE_LA_CUENTA, (columnas) =>
          client
            .from("cuentas")
            .select(columnas)
            .eq("id", cuentaId)
            .maybeSingle<CuentaResumen>(),
        );
  const cuenta = lecturaCuenta?.data;
  const perfil: Usuario = cuenta ? { ...data, cuenta } : data;
  perfilEnCache = { perfil, leidoEn: Date.now() };
  return perfil;
};

export const getPerfil = async (): Promise<Usuario | undefined> => {
  if (perfilEnCache && Date.now() - perfilEnCache.leidoEn < PERFIL_TTL_MS) {
    return perfilEnCache.perfil;
  }
  // Sin conexión, la última copia conocida es mejor que expulsar al usuario
  return (await leerPerfil().catch(() => undefined)) ?? perfilEnCache?.perfil;
};

/** Descarta la copia en memoria (tras editar el propio perfil). */
export const invalidarPerfil = () => {
  perfilEnCache = null;
};

export const getAuthProvider = (): AuthProvider => {
  const base = supabaseAuthProvider(getSupabaseClient(), {
    getIdentity: async (): Promise<CrmIdentity> => {
      const perfil = await getPerfil();
      if (!perfil) throw new Error("Perfil no encontrado");
      return {
        id: perfil.id,
        fullName: `${perfil.nombre} ${perfil.apellido}`.trim(),
        email: perfil.email,
        rol: perfil.rol,
        modulos: perfil.modulos,
        plataforma: perfil.plataforma === true,
        cuenta: perfil.cuenta,
        debeCambiarClave: perfil.debe_cambiar_clave === true,
      };
    },
  });

  return {
    ...base,
    logout: async (params) => {
      invalidarPerfil();
      return base.logout(params);
    },
    checkAuth: async (params) => {
      await base.checkAuth(params);
      // Un usuario dado de baja pierde el acceso en la siguiente navegación
      const perfil = await getPerfil();
      if (!perfil || !perfil.activo) {
        throw new Error("ra.auth.auth_check_error");
      }
    },
    checkError: async (error) => {
      // 403 es un permiso que la base negó: la sesión sigue siendo válida
      if ((error as { status?: number } | null)?.status === 403) return;
      return base.checkError(error);
    },
    canAccess: async ({ resource, action }) => {
      const perfil = await getPerfil();
      if (!perfil || !perfil.activo) return false;
      return puedeAcceder(perfil, resource, action);
    },
  };
};

// Al ritmo del perfil: un módulo quitado desaparece del menú en un par de minutos
const OPCIONES_IDENTIDAD = {
  staleTime: PERFIL_TTL_MS,
  refetchInterval: PERFIL_TTL_MS,
};

export const useCrmIdentity = () => {
  const { data, isPending } = useGetIdentity(OPCIONES_IDENTIDAD);
  return { identity: data as CrmIdentity | undefined, isPending };
};

export const useEsAdministrador = (): boolean => {
  const { identity } = useCrmIdentity();
  // Una cuenta suspendida, o con la prueba gratis vencida, no administra nada hasta que la reactiven
  return (
    identity?.rol === "administrador" &&
    (identity.cuenta === undefined || cuentaVigente(identity.cuenta))
  );
};

/** El dueño del sistema: ve y administra las cuentas. */
export const useEsPlataforma = (): boolean =>
  useCrmIdentity().identity?.plataforma === true;

/**
 * `tiene("clientes")`: si el usuario tiene ese módulo. Mientras carga la
 * identidad responde que no, así nada aparece y después desaparece.
 */
export const useModulos = () => {
  const { identity } = useCrmIdentity();
  return { tiene: (modulo: Modulo) => tieneModulo(identity, modulo) };
};
