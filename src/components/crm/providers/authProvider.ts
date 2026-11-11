import { useGetIdentity, type AuthProvider, type UserIdentity } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import type { Rol, Usuario } from "../domain/types";
import { puedeAcceder } from "./permissions";
import { getSupabaseClient } from "./supabase";

export interface CrmIdentity extends UserIdentity {
  id: string;
  fullName: string;
  email: string;
  rol: Rol;
}

// El perfil se vuelve a consultar cada minuto: un cambio de rol o una baja
// no puede depender de una copia vieja del navegador.
const PERFIL_TTL_MS = 60 * 1000;
let perfilEnCache: { perfil: Usuario; leidoEn: number } | null = null;

const leerPerfil = async (): Promise<Usuario | undefined> => {
  const client = getSupabaseClient();
  const { data: sesion } = await client.auth.getSession();
  const userId = sesion.session?.user.id;
  if (!userId) return undefined;

  const { data } = await client
    .from("usuarios")
    .select("id, nombre, apellido, email, rol, activo, creado_en")
    .eq("id", userId)
    .maybeSingle<Usuario>();
  if (data) perfilEnCache = { perfil: data, leidoEn: Date.now() };
  return data ?? undefined;
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
      return puedeAcceder(perfil.rol, resource, action);
    },
  };
};

export const useCrmIdentity = () => {
  const { data, isPending } = useGetIdentity();
  return { identity: data as CrmIdentity | undefined, isPending };
};

export const useEsAdministrador = (): boolean =>
  useCrmIdentity().identity?.rol === "administrador";
