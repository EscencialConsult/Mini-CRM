import type { AccionAuditoria, EntidadAuditoria } from "../domain/types";

interface Sustantivo {
  /** Con artículo: "el cliente". */
  conArticulo: string;
  /** Con "de": "del cliente". */
  conDe: string;
  /** Con "a": "al cliente". */
  conA: string;
}

const SUSTANTIVOS: Record<EntidadAuditoria, Sustantivo> = {
  clientes: {
    conArticulo: "el cliente",
    conDe: "del cliente",
    conA: "al cliente",
  },
  oportunidades: {
    conArticulo: "la oportunidad",
    conDe: "de la oportunidad",
    conA: "a la oportunidad",
  },
  actividades: {
    conArticulo: "la tarea",
    conDe: "de la tarea",
    conA: "a la tarea",
  },
  usuarios: {
    conArticulo: "el usuario",
    conDe: "del usuario",
    conA: "al usuario",
  },
  landings: {
    conArticulo: "la landing",
    conDe: "de la landing",
    conA: "a la landing",
  },
};

/** "Creó el cliente “Juan Pérez”", sin el nombre de quien lo hizo. */
export const textoAuditoria = (
  accion: AccionAuditoria,
  entidad: EntidadAuditoria,
  descripcion: string | null,
): string => {
  const sustantivo = SUSTANTIVOS[entidad];
  const nombre = descripcion ? ` “${descripcion}”` : "";
  switch (accion) {
    case "crear":
      return `Creó ${sustantivo.conArticulo}${nombre}`;
    case "editar":
      return `Editó ${sustantivo.conArticulo}${nombre}`;
    case "eliminar":
      return `Eliminó ${sustantivo.conArticulo}${nombre}`;
    case "activar":
      return `Activó ${sustantivo.conA}${nombre}`;
    case "desactivar":
      return `Desactivó ${sustantivo.conA}${nombre}`;
    case "cambiar_rol":
      return `Cambió el rol ${sustantivo.conDe}${nombre}`;
    case "restablecer_clave":
      return `Restableció la clave ${sustantivo.conDe}${nombre}`;
    case "publicar":
      return `Publicó ${sustantivo.conArticulo}${nombre}`;
    case "despublicar":
      return `Despublicó ${sustantivo.conArticulo}${nombre}`;
  }
};

/** Nombre legible de las columnas que aparecen en los cambios. */
export const ETIQUETAS_CAMPO: Record<string, string> = {
  tipo: "Tipo",
  nombre: "Nombre",
  apellido: "Apellido",
  razon_social: "Razón social",
  documento: "Documento",
  telefono: "Teléfono",
  email: "Email",
  direccion: "Dirección",
  estado: "Estado",
  proximo_contacto: "Próximo contacto",
  asignado_a: "Responsable",
  asignados: "Responsables",
  cliente_id: "Cliente",
  producto_servicio: "Producto o servicio",
  descripcion: "Detalle",
  importe_estimado: "Importe estimado",
  etapa: "Etapa",
  probabilidad: "Probabilidad",
  resultado: "Resultado",
  fecha_cierre_estimada: "Cierre estimado",
  fecha_cierre: "Fecha de cierre",
  motivo_perdida_tipo: "Motivo de la pérdida",
  motivo_perdida: "Detalle de la pérdida",
  oportunidad_id: "Oportunidad",
  titulo: "Título",
  fecha: "Fecha",
  completada: "Completada",
  completada_en: "Completada el",
  rol: "Rol",
  activo: "Activo",
  slug: "Dirección web",
  landing_id: "Landing de origen",
  etiquetas: "Etiquetas",
  modulos: "Módulos",
  productos: "Productos",
  canal_id: "Canal",
};

/** Campos internos que no aportan al detalle de un cambio. */
export const CAMPOS_OCULTOS = new Set([
  "id",
  "creado_en",
  "creado_por",
  "actualizado_en",
  "actualizado_por",
  "nombre_completo",
]);
