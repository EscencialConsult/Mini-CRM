import { useGetIdentity, type AuthProvider, type UserIdentity } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import { tieneModulo, type Modulo } from "../domain/modulos";
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
}

// El perfil se vuelve a consultar cada minuto: un cambio de rol o una baja
// no puede depender de una copia vieja del navegador.
const PERFIL_TTL_MS = 60 * 1000;
const COLUMNAS_PERFIL =
  "id, nombre, apellido, email, rol, activo, modulos, creado_en";
let perfilEnCache: { perfil: Usuario; leidoEn: number } | null = null;

const leerPerfil = async (): Promise<Usuario | undefined> => {
  const client = getSupabaseClient();
  const { data: sesion } = await client.auth.getSession();
  const userId = sesion.session?.user.id;
  if (!userId) return undefined;

  const completo = await client
    .from("usuarios")
    .select(`${COLUMNAS_PERFIL}, cuenta_id, plataforma`)
    .eq("id", userId)
    .maybeSingle<Usuario>();
  // Si el sitio sale antes que la migración de cuentas, esas columnas no existen
  // todavía: se lee el perfil de siempre y el CRM sigue funcionando como antes.
  const { data } = completo.error
    ? await client
        .from("usuarios")
        .select(COLUMNAS_PERFIL)
        .eq("id", userId)
        .maybeSingle<Usuario>()
    : completo;
  if (!data) return undefined;

  // Su cuenta (RLS solo deja leer la propia). Sin ella no se limita nada en la
  // pantalla: la base igual rechaza lo que la cuenta no tiene.
  const { data: cuenta } =
    data.cuenta_id === undefined
      ? { data: null }
      : await client
          .from("cuentas")
          .select("id, nombre, activa, modulos, max_usuarios")
          .eq("id", data.cuenta_id)
          .maybeSingle<CuentaResumen>();
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
  // Una cuenta suspendida no administra nada hasta que la reactiven
  return identity?.rol === "administrador" && identity.cuenta?.activa !== false;
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
