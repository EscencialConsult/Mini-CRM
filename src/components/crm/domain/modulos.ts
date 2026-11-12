import type { Rol } from "./types";

/**
 * Partes del CRM que el administrador habilita por usuario. Mismo orden y
 * valores que el CHECK `usuarios_modulos_validos` y la Edge Function `users`.
 * Usuarios no es un módulo: es siempre del administrador.
 */
export type Modulo =
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

export interface DefinicionModulo {
  id: Modulo;
  nombre: string;
  descripcion: string;
  ruta: string;
}

export const MODULOS: readonly DefinicionModulo[] = [
  {
    id: "panel",
    nombre: "Panel",
    descripcion: "Indicadores y seguimiento (de los módulos que tenga).",
    ruta: "/",
  },
  {
    id: "clientes",
    nombre: "Clientes",
    descripcion: "Crear, editar y ver la ficha de clientes.",
    ruta: "/clientes",
  },
  {
    id: "oportunidades",
    nombre: "Tablero",
    descripcion: "Oportunidades por etapa y listado.",
    ruta: "/oportunidades",
  },
  {
    id: "pedidos",
    nombre: "Pedidos",
    descripcion:
      "Pedidos de WhatsApp y de la landing: seguimiento y cambio de estado.",
    ruta: "/pedidos",
  },
  {
    id: "actividades",
    nombre: "Tareas",
    descripcion: "Llamadas, reuniones, notas y tareas.",
    ruta: "/actividades",
  },
  {
    id: "productos",
    nombre: "Productos",
    descripcion: "Catálogo de productos: precios, altas y bajas.",
    ruta: "/productos",
  },
  {
    id: "ventas",
    nombre: "Ventas",
    descripcion: "Ventas ganadas, reportes y ranking de vendedores.",
    ruta: "/ventas",
  },
  {
    id: "landings",
    nombre: "Landings",
    descripcion: "Crear, publicar y ver resultados de landings.",
    ruta: "/landings",
  },
  {
    id: "etiquetas",
    nombre: "Etiquetas",
    descripcion: "Catálogo de etiquetas: renombrar, recolorear y borrar.",
    ruta: "/etiquetas",
  },
  {
    id: "auditoria",
    nombre: "Auditoría",
    descripcion: "Historial de cambios de todo el CRM.",
    ruta: "/auditoria",
  },
];

export const MODULOS_POR_DEFECTO: Modulo[] = [
  "panel",
  "clientes",
  "oportunidades",
  "actividades",
];

export const nombreModulo = (id: string): string =>
  MODULOS.find((modulo) => modulo.id === id)?.nombre ?? id;

export interface PerfilConModulos {
  rol: Rol;
  modulos: readonly Modulo[];
}

/** El administrador tiene todos; el resto, los que le asignaron. */
export const tieneModulo = (
  perfil: PerfilConModulos | undefined,
  modulo: Modulo,
): boolean =>
  !!perfil &&
  (perfil.rol === "administrador" || perfil.modulos.includes(modulo));

/** Primera pantalla que puede abrir: donde aterriza si no tiene el Panel. */
export const rutaInicial = (perfil: PerfilConModulos): string | undefined =>
  MODULOS.find((modulo) => tieneModulo(perfil, modulo.id))?.ruta;
