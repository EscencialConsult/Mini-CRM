import type { RaRecord } from "ra-core";

import type { Modulo } from "./modulos";

export type Rol = "administrador" | "vendedor";
export type TipoCliente = "persona" | "empresa";
export type EstadoCliente = "activo" | "inactivo";
export type Etapa = "prospecto" | "calificado" | "propuesta" | "negociacion";
export type Resultado = "abierta" | "ganada" | "perdida";
export type MotivoPerdida =
  "precio" | "competencia" | "sin_respuesta" | "otra_solucion" | "otro";
export type TipoActividad = "llamada" | "reunion" | "nota" | "tarea";
export type EntidadAuditoria =
  | "clientes"
  | "oportunidades"
  | "actividades"
  | "usuarios"
  | "landings"
  | "pedidos";
export type AccionAuditoria =
  | "crear"
  | "editar"
  | "eliminar"
  | "activar"
  | "desactivar"
  | "cambiar_rol"
  | "restablecer_clave"
  | "publicar"
  | "despublicar";

/** Campos de autoría que completa la base (no se editan desde la app). */
interface Autoria {
  creado_en: string;
  actualizado_en: string;
  creado_por: string | null;
  actualizado_por: string | null;
  creado_por_nombre?: string | null;
  actualizado_por_nombre?: string | null;
}

export interface Usuario extends RaRecord<string> {
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  activo: boolean;
  /** Para el administrador no se usa: tiene todos. */
  modulos: Modulo[];
  creado_en: string;
  /** Usuario del sistema (el "Bot WhatsApp"): no inicia sesión ni se asigna a nadie. */
  sistema?: boolean;
}

export interface Cliente extends RaRecord<number>, Autoria {
  tipo: TipoCliente;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  nombre_completo: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  estado: EstadoCliente;
  proximo_contacto: string | null;
  asignado_a: string | null;
  /** Landing por la que llegó (la primera vez) */
  landing_id: number | null;
  /** Ids de sus etiquetas, en el orden en que se pusieron */
  etiquetas: number[];
  /** Canal de origen: por dónde llegó */
  canal_id: number | null;
  // Vista clientes_resumen
  asignado_nombre?: string | null;
  landing_nombre?: string | null;
  canal_nombre?: string | null;
  oportunidades_abiertas?: number;
  importe_abierto?: number;
  actividades_pendientes?: number;
  ultima_actividad?: string | null;
}

export type ColorEtiqueta =
  | "gris"
  | "rojo"
  | "naranja"
  | "ambar"
  | "verde"
  | "turquesa"
  | "azul"
  | "violeta"
  | "rosa";

export interface Etiqueta extends RaRecord<number> {
  nombre: string;
  color: ColorEtiqueta;
  creado_en: string;
  creado_por: string | null;
  // Vista etiquetas_resumen
  clientes?: number;
  creado_por_nombre?: string | null;
}

export interface Producto extends RaRecord<number>, Autoria {
  nombre: string;
  descripcion: string | null;
  /** Precio de lista */
  precio: number;
  /** Inactivo: no se puede agregar a oportunidades (las que ya lo tienen lo conservan). */
  activo: boolean;
  // Vista productos_resumen
  oportunidades?: number;
  pedidos?: number;
}

export interface Canal extends RaRecord<number> {
  nombre: string;
  /** Canal que usa el sistema (hoy solo 'landing'): no se borra. */
  clave: string | null;
  activo: boolean;
  creado_en: string;
  // Vista canales_resumen
  clientes?: number;
  oportunidades?: number;
}

/** Línea de una oportunidad; la base completa `nombre` y `subtotal`. */
export interface LineaProducto {
  producto_id: number;
  nombre?: string;
  cantidad: number;
  precio_unitario: number;
  /** Porcentaje, de 0 a 100. */
  descuento: number;
  subtotal?: number;
}

export interface Oportunidad extends RaRecord<number>, Autoria {
  cliente_id: number;
  /** Título armado por la base a partir de las líneas ("A", "A y B", "A y 2 más"). */
  producto_servicio: string;
  descripcion: string | null;
  /** Suma de los subtotales (lo calcula la base). */
  importe_estimado: number;
  productos: LineaProducto[];
  canal_id: number | null;
  etapa: Etapa;
  probabilidad: number;
  resultado: Resultado;
  fecha_cierre_estimada: string | null;
  fecha_cierre: string | null;
  /** Obligatorio si se perdió (catálogo fijo, para los reportes). */
  motivo_perdida_tipo: MotivoPerdida | null;
  /** Detalle libre de la pérdida (opcional). */
  motivo_perdida: string | null;
  /** Responsables, todos iguales (vacío: sin asignar). */
  asignados: string[];
  /** Pedido del que viene esta venta: se cambia desde Pedidos, no se edita acá. */
  pedido_id?: number | null;
  // Vista oportunidades_resumen
  cliente_nombre?: string;
  cliente_estado?: EstadoCliente;
  cliente_tipo?: TipoCliente;
  asignado_nombre?: string | null;
  canal_nombre?: string | null;
}

export interface Actividad extends RaRecord<number>, Autoria {
  tipo: TipoActividad;
  cliente_id: number;
  oportunidad_id: number | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  completada: boolean;
  completada_en: string | null;
  /** Responsables, todos iguales (vacío: sin asignar). */
  asignados: string[];
  // Vista actividades_resumen
  cliente_nombre?: string;
  oportunidad_nombre?: string | null;
  asignado_nombre?: string | null;
  vencida?: boolean;
  cliente_tipo?: TipoCliente;
}

export type EstadoPedido =
  | "nuevo"
  | "en_preparacion"
  | "en_camino"
  | "listo_para_retirar"
  | "entregado"
  | "cancelado";
export type OrigenPedido = "whatsapp" | "manual" | "landing";
export type EntregaPedido = "envio" | "retiro";

/** Línea de un pedido: la base completa `nombre` y `subtotal`. */
export type LineaPedido = LineaProducto;

export interface Pedido extends RaRecord<number>, Autoria {
  cliente_id: number;
  origen: OrigenPedido;
  estado: EstadoPedido;
  /** `null`: «a coordinar» (la landing no define la entrega) */
  tipo_entrega: EntregaPedido | null;
  direccion: string | null;
  /** Sin fecha: "para ahora". */
  entrega_en: string | null;
  productos: LineaPedido[];
  total: number;
  /** Armado por la base ("A", "A y B", "A y 2 más"). */
  titulo: string;
  nota: string | null;
  telefono_whatsapp: string | null;
  prueba: boolean;
  entregado_en: string | null;
  // Vista pedidos_resumen
  cliente_nombre?: string;
  cliente_telefono?: string | null;
  /** La venta enlazada (solo la ve quien tiene Tablero o Ventas). */
  venta_id?: number | null;
}

export interface PedidoHistorial extends RaRecord<number> {
  pedido_id: number;
  fecha: string;
  estado_anterior: EstadoPedido | null;
  estado: EstadoPedido;
  usuario_id: string | null;
  /** Sin usuario (el bot, la landing): de dónde vino el cambio. */
  origen: string | null;
  motivo: string | null;
}

export interface RegistroAuditoria extends RaRecord<number> {
  fecha: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  entidad: EntidadAuditoria;
  registro_id: string;
  cliente_id: number | null;
  accion: AccionAuditoria;
  descripcion: string | null;
  cambios: Record<string, unknown> | null;
  /** Sin usuario: de dónde vino el cambio (por ejemplo, una landing) */
  origen: string | null;
}

export type EstadoLanding = "borrador" | "publicada";

export interface Landing extends RaRecord<number> {
  nombre: string;
  /** Ruta pública: <VITE_LANDINGS_URL>/<slug> */
  slug: string;
  estado: EstadoLanding;
  /** Lo que se edita (LandingContent sin normalizar) */
  borrador: unknown;
  /** Lo que ven los visitantes; null si nunca se publicó */
  publicada?: unknown;
  publicada_en: string | null;
  publicada_por?: string | null;
  creado_en: string;
  actualizado_en: string;
  creado_por?: string | null;
  actualizado_por?: string | null;
}

/** Cifras de una landing para el listado (landings_indicadores). */
export interface LandingIndicadores {
  landing_id: number;
  visitas: number;
  envios: number;
  ventas: number;
  ultimo_envio: string | null;
}

/** Resultados de una landing (landing_estadisticas). */
export interface LandingEstadisticas {
  dias: number;
  visitas: number;
  envios: number;
  clientes_nuevos: number;
  ventas: number;
  importe_ganado: number;
  ultimo_envio: string | null;
  por_dia: { dia: string; visitas: number; envios: number }[];
  fuentes: { etiqueta: string; envios: number }[];
  campanias: { etiqueta: string; envios: number }[];
  recientes: {
    cliente_id: number | null;
    cliente_nombre: string | null;
    tipo: "formulario" | "whatsapp" | "pedido";
    cliente_nuevo: boolean;
    utm_source: string | null;
    utm_campaign: string | null;
    creado_en: string;
  }[];
}

export interface PanelIndicadores {
  clientes_total: number;
  clientes_activos: number;
  clientes_nuevos: number;
  oportunidades_abiertas: number;
  importe_abierto: number;
  importe_ponderado: number;
  ganadas_cantidad: number;
  ganadas_importe: number;
  perdidas_cantidad: number;
  perdidas_importe: number;
  actividades_pendientes: number;
  actividades_vencidas: number;
}

export interface VentasPorMes {
  mes: string;
  ganadas_cantidad: number;
  ganadas_importe: number;
  perdidas_cantidad: number;
  perdidas_importe: number;
}

/** Reportes de la sección Ventas (ventas_reporte): cerradas del período y filtros. */
export interface VentasReporte {
  indicadores: {
    total_vendido: number;
    ventas: number;
    ticket_promedio: number | null;
    /** Días promedio entre el alta y el cierre de las ganadas. */
    ciclo_promedio: number | null;
    perdidas: number;
    importe_perdido: number;
    /** Ganadas sobre ganadas + perdidas (0 a 1); null sin cerradas. */
    tasa_cierre: number | null;
  };
  por_canal: {
    canal_id: number | null;
    nombre: string;
    ventas: number;
    importe: number;
  }[];
  /** Con varios responsables, cada uno suma la venta completa. */
  ranking: {
    usuario_id: string;
    nombre: string;
    ventas: number;
    importe: number;
    perdidas: number;
    tasa_cierre: number | null;
    ciclo_promedio: number | null;
  }[];
  productos: {
    producto_id: number;
    nombre: string;
    cantidad: number;
    importe: number;
    ventas: number;
  }[];
  motivos: { motivo: MotivoPerdida; cantidad: number; importe: number }[];
}

export interface EmbudoEtapa {
  etapa: Etapa;
  cantidad: number;
  importe: number;
}

export interface RecordatoriosConteo {
  actividades_vencidas: number;
  actividades_hoy: number;
  contactos_vencidos: number;
  contactos_hoy: number;
}

export interface NuevoUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  modulos: Modulo[];
}

export interface CambiosUsuario {
  id: string;
  nombre?: string;
  apellido?: string;
  rol?: Rol;
  activo?: boolean;
  password?: string;
  modulos?: Modulo[];
}
