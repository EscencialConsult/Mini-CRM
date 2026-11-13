import {
  tieneModulo,
  type Modulo,
  type PerfilConModulos,
} from "../domain/modulos";

type Accion = "list" | "show" | "create" | "edit" | "delete";

const TODAS: readonly Accion[] = ["list", "show", "create", "edit", "delete"];
const SIN_BORRAR: readonly Accion[] = ["list", "show", "create", "edit"];

/**
 * Recurso de ra-core → módulo que lo habilita. `usuarios` y `canales` no
 * tienen: son del administrador.
 */
const MODULO_DE_RECURSO: Record<string, Modulo> = {
  clientes: "clientes",
  oportunidades: "oportunidades",
  pedidos: "pedidos",
  actividades: "actividades",
  productos: "productos",
  ventas: "ventas",
  landings: "landings",
  etiquetas: "etiquetas",
  auditoria: "auditoria",
};

/**
 * Qué puede hacer cada rol dentro de un módulo habilitado. La autoridad real
 * es RLS en la base: esto solo evita mostrar lo que la base va a rechazar.
 */
const ACCIONES: Record<
  PerfilConModulos["rol"],
  Record<string, readonly Accion[]>
> = {
  administrador: {
    clientes: TODAS,
    oportunidades: TODAS,
    pedidos: TODAS,
    actividades: TODAS,
    usuarios: TODAS,
    auditoria: ["list", "show"],
    landings: TODAS,
    etiquetas: TODAS,
    productos: TODAS,
    // Sin módulo: el catálogo de canales es solo del administrador
    canales: TODAS,
    ventas: ["list"],
  },
  vendedor: {
    // Borrado definitivo solo del administrador; el vendedor inactiva
    clientes: SIN_BORRAR,
    oportunidades: SIN_BORRAR,
    // Borrar un pedido es del administrador (la base lo exige)
    pedidos: SIN_BORRAR,
    // Puede eliminar sus propias actividades (la base lo verifica por autor)
    actividades: TODAS,
    // Crea, edita y publica; eliminar (borrado definitivo) es del administrador
    landings: SIN_BORRAR,
    // Con el módulo, administra el catálogo
    etiquetas: TODAS,
    // Con el módulo, administra el catálogo (lo que está en uso se desactiva)
    productos: TODAS,
    // Solo lectura: las ganadas se editan desde el Tablero
    ventas: ["list"],
    auditoria: ["list", "show"],
  },
};

export const puedeAcceder = (
  perfil: PerfilConModulos,
  resource: string | undefined,
  action: string,
): boolean => {
  if (!resource) return true;
  // Las cuentas son solo del dueño del sistema (la Edge Function lo vuelve a exigir)
  if (resource === "cuentas") {
    return !!perfil.plataforma && (SIN_BORRAR as readonly string[]).includes(action);
  }
  // Cuenta suspendida: no puede abrir nada hasta que la reactiven
  if (perfil.cuenta && !perfil.cuenta.activa) return false;
  const modulo = MODULO_DE_RECURSO[resource];
  if (modulo && !tieneModulo(perfil, modulo)) return false;
  return (ACCIONES[perfil.rol][resource] ?? []).includes(action as Accion);
};
