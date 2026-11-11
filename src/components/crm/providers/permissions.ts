import type { Rol } from "../domain/types";

type Accion = "list" | "show" | "create" | "edit" | "delete";

const TODAS: readonly Accion[] = ["list", "show", "create", "edit", "delete"];
const SIN_BORRAR: readonly Accion[] = ["list", "show", "create", "edit"];

/**
 * Permisos de interfaz por rol. La autoridad real es RLS en la base:
 * esto solo evita mostrar acciones que la base va a rechazar.
 */
const PERMISOS: Record<Rol, Record<string, readonly Accion[]>> = {
  administrador: {
    clientes: TODAS,
    oportunidades: TODAS,
    actividades: TODAS,
    usuarios: TODAS,
    auditoria: ["list", "show"],
    landings: TODAS,
  },
  vendedor: {
    // Borrado definitivo solo del administrador; el vendedor inactiva
    clientes: SIN_BORRAR,
    oportunidades: SIN_BORRAR,
    // Puede eliminar sus propias actividades (la base lo verifica por autor)
    actividades: TODAS,
    // Crea, edita y publica; eliminar (borrado definitivo) es del administrador
    landings: SIN_BORRAR,
  },
};

export const puedeAcceder = (
  rol: Rol,
  resource: string | undefined,
  action: string,
): boolean => {
  if (!resource) return true;
  return (PERMISOS[rol][resource] ?? []).includes(action as Accion);
};
