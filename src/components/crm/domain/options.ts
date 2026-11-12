import type {
  AccionAuditoria,
  ColorEtiqueta,
  EntidadAuditoria,
  EntregaPedido,
  EstadoCliente,
  EstadoPedido,
  Etapa,
  MotivoPerdida,
  OrigenPedido,
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
  { id: "pedidos", name: "Pedidos" },
];

export const ESTADOS_PEDIDO: Opcion<EstadoPedido>[] = [
  { id: "nuevo", name: "Nuevo" },
  { id: "en_preparacion", name: "En preparación" },
  { id: "en_camino", name: "En camino" },
  { id: "listo_para_retirar", name: "Listo para retirar" },
  { id: "entregado", name: "Entregado" },
  { id: "cancelado", name: "Cancelado" },
];

export const ENTREGAS_PEDIDO: Opcion<EntregaPedido>[] = [
  { id: "envio", name: "Envío" },
  { id: "retiro", name: "Retiro" },
];

/** Pedido sin tipo de entrega (`tipo_entrega` nulo): se resuelve con el cliente. */
export const ENTREGA_A_COORDINAR = "coordinar";
export const NOMBRE_A_COORDINAR = "A coordinar";

/** Para el filtro del listado y el alta: los tipos y «A coordinar». */
export const ENTREGAS_PEDIDO_CON_COORDINAR: Opcion<string>[] = [
  ...ENTREGAS_PEDIDO,
  { id: ENTREGA_A_COORDINAR, name: NOMBRE_A_COORDINAR },
];

/** Nombre de la entrega de un pedido; nulo es «A coordinar». */
export const nombreEntrega = (entrega: EntregaPedido | null): string =>
  entrega === null ? NOMBRE_A_COORDINAR : nombreDe(ENTREGAS_PEDIDO, entrega);

export const ORIGENES_PEDIDO: Opcion<OrigenPedido>[] = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "landing", name: "Landing" },
  { id: "manual", name: "Cargado por el equipo" },
];

/**
 * El camino normal de un pedido: "En camino" es del envío y "Listo para
 * retirar" del retiro (la base lo exige). A coordinar no tiene un paso fijo
 * en el medio: se elige cuál (ver `estadosAlcanzables`).
 */
export const caminoPedido = (entrega: EntregaPedido | null): EstadoPedido[] =>
  entrega === null
    ? ["nuevo", "en_preparacion", "entregado"]
    : [
        "nuevo",
        "en_preparacion",
        entrega === "envio" ? "en_camino" : "listo_para_retirar",
        "entregado",
      ];

/** El paso que sigue en el camino; sin paso si ya se entregó o se canceló. */
export const proximoEstado = (
  estado: EstadoPedido,
  entrega: EntregaPedido | null,
): EstadoPedido | null => {
  // A coordinar: desde cualquiera de los dos pasos de salida se entrega
  if (
    entrega === null &&
    (estado === "en_camino" || estado === "listo_para_retirar")
  ) {
    return "entregado";
  }
  const camino = caminoPedido(entrega);
  const indice = camino.indexOf(estado);
  return indice >= 0 ? (camino[indice + 1] ?? null) : null;
};

/**
 * Todos los estados a los que se puede pasar desde el actual (el camino y
 * Cancelado). A coordinar admite En camino y Listo para retirar.
 */
export const estadosAlcanzables = (
  estado: EstadoPedido,
  entrega: EntregaPedido | null,
): EstadoPedido[] => {
  const camino: EstadoPedido[] =
    entrega === null
      ? [
          "nuevo",
          "en_preparacion",
          "en_camino",
          "listo_para_retirar",
          "entregado",
        ]
      : caminoPedido(entrega);
  const todos: EstadoPedido[] = [...camino, "cancelado"];
  return todos.filter((otro) => otro !== estado);
};

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
