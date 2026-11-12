import type {
  AccionAuditoria,
  ColorEtiqueta,
  EntidadAuditoria,
  EstadoCliente,
  Etapa,
  MotivoPerdida,
  Resultado,
  Rol,
  TipoActividad,
  TipoCliente,
} from "./types";

export interface Opcion<T extends string> {
  id: T;
  name: string;
}

export const TIPOS_CLIENTE: Opcion<TipoCliente>[] = [
  { id: "persona", name: "Persona" },
  { id: "empresa", name: "Empresa" },
];

/** Paleta de las etiquetas, en el orden en que la base las reparte al crearlas. */
export const COLORES_ETIQUETA: Opcion<ColorEtiqueta>[] = [
  { id: "azul", name: "Azul" },
  { id: "verde", name: "Verde" },
  { id: "naranja", name: "Naranja" },
  { id: "violeta", name: "Violeta" },
  { id: "rosa", name: "Rosa" },
  { id: "turquesa", name: "Turquesa" },
  { id: "ambar", name: "Ámbar" },
  { id: "rojo", name: "Rojo" },
  { id: "gris", name: "Gris" },
];

export const ESTADOS_CLIENTE: Opcion<EstadoCliente>[] = [
  { id: "activo", name: "Activo" },
  { id: "inactivo", name: "Inactivo" },
];

export interface EtapaOpcion extends Opcion<Etapa> {
  /** Probabilidad de cierre sugerida al elegir la etapa (editable). */
  probabilidad: number;
}

export const ETAPAS: EtapaOpcion[] = [
  { id: "prospecto", name: "Prospecto", probabilidad: 10 },
  { id: "calificado", name: "Calificado", probabilidad: 25 },
  { id: "propuesta", name: "Propuesta", probabilidad: 50 },
  { id: "negociacion", name: "Negociación", probabilidad: 75 },
];

export const RESULTADOS: Opcion<Resultado>[] = [
  { id: "abierta", name: "Abierta" },
  { id: "ganada", name: "Ganada" },
  { id: "perdida", name: "Perdida" },
];

export const MOTIVOS_PERDIDA: Opcion<MotivoPerdida>[] = [
  { id: "precio", name: "Precio" },
  { id: "competencia", name: "Competencia" },
  { id: "sin_respuesta", name: "Sin respuesta" },
  { id: "otra_solucion", name: "Eligió otra solución" },
  { id: "otro", name: "Otro" },
];

export const TIPOS_ACTIVIDAD: Opcion<TipoActividad>[] = [
  { id: "llamada", name: "Llamada" },
  { id: "reunion", name: "Reunión" },
  { id: "nota", name: "Nota" },
  { id: "tarea", name: "Otra" },
];

export const ROLES: Opcion<Rol>[] = [
  { id: "administrador", name: "Administrador" },
  { id: "vendedor", name: "Vendedor" },
];

export const ENTIDADES_AUDITORIA: Opcion<EntidadAuditoria>[] = [
  { id: "clientes", name: "Clientes" },
  { id: "oportunidades", name: "Oportunidades" },
  { id: "actividades", name: "Tareas" },
  { id: "usuarios", name: "Usuarios" },
  { id: "landings", name: "Landings" },
];

export const ACCIONES_AUDITORIA: Opcion<AccionAuditoria>[] = [
  { id: "crear", name: "Creó" },
  { id: "editar", name: "Editó" },
  { id: "eliminar", name: "Eliminó" },
  { id: "activar", name: "Activó" },
  { id: "desactivar", name: "Desactivó" },
  { id: "cambiar_rol", name: "Cambió el rol de" },
  { id: "restablecer_clave", name: "Restableció la clave de" },
  { id: "publicar", name: "Publicó" },
  { id: "despublicar", name: "Despublicó" },
];

export const nombreDe = <T extends string>(
  opciones: readonly Opcion<T>[],
  id: string | null | undefined,
): string => opciones.find((opcion) => opcion.id === id)?.name ?? id ?? "";

export const probabilidadDeEtapa = (etapa: Etapa): number =>
  ETAPAS.find((opcion) => opcion.id === etapa)?.probabilidad ?? 0;
