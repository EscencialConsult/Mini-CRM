import { supabaseDataProvider } from "ra-supabase-core";
import {
  HttpError,
  useDataProvider,
  type CreateParams,
  type DataProvider,
  type DeleteManyParams,
  type DeleteParams,
  type GetListParams,
  type GetManyParams,
  type GetManyReferenceParams,
  type GetOneParams,
  type Identifier,
  type RaRecord,
  type SortPayload,
  type UpdateManyParams,
  type UpdateParams,
} from "ra-core";

import type {
  CambiosUsuario,
  EstadoPedido,
  Landing,
  LandingEstadisticas,
  LandingIndicadores,
  NuevoUsuario,
  Pedido,
  Usuario,
} from "../domain/types";
import {
  findPublishProblems,
  isValidSlug,
  normalizeLandingContent,
} from "../landings/pagina/schema.ts";
import { getSupabaseClient } from "./supabase";

interface ResourceConfig {
  table: string;
  /** Vista de lectura con nombres ya resueltos (security_invoker). */
  view?: string;
  /** Columnas que la app puede escribir; el resto se descarta antes de enviar. */
  writable: readonly string[];
  /**
   * El filtro `q` busca en la columna `busqueda`: normalizada sin tildes en las
   * vistas, solo en minúsculas en la tabla de usuarios.
   */
  busqueda?: "sin_tildes" | "minusculas";
  /**
   * Varios responsables (columna `asignados`, una lista): el filtro
   * `asignado_a` de la pantalla busca a esa persona entre ellos.
   */
  variosResponsables?: boolean;
  /** Columnas que son listas: el filtro `columna: valor` busca ese valor en la lista. */
  listas?: readonly string[];
  /**
   * Líneas de productos (columna `productos`): el filtro `producto_id: 3`
   * busca las que tienen ese producto.
   */
  lineasProductos?: boolean;
}

const RESOURCES: Record<string, ResourceConfig> = {
  clientes: {
    table: "clientes",
    view: "clientes_resumen",
    writable: [
      "tipo",
      "nombre",
      "apellido",
      "razon_social",
      "documento",
      "telefono",
      "email",
      "direccion",
      "estado",
      "proximo_contacto",
      "asignado_a",
      "etiquetas",
      "canal_id",
    ],
    busqueda: "sin_tildes",
    listas: ["etiquetas"],
  },
  // Cualquiera crea; renombrar, cambiar el color y borrar es de quien tiene el módulo (RLS)
  etiquetas: {
    table: "etiquetas",
    view: "etiquetas_resumen",
    writable: ["nombre", "color"],
  },
  // Catálogo del módulo Productos; un producto en uso no se borra, se desactiva
  productos: {
    table: "productos",
    view: "productos_resumen",
    writable: ["nombre", "descripcion", "precio", "activo"],
    busqueda: "sin_tildes",
  },
  // Solo el administrador (RLS); el canal del sistema (Landing) no se borra
  canales: {
    table: "canales",
    view: "canales_resumen",
    writable: ["nombre", "activo"],
  },
  // Título (`producto_servicio`) e importe salen de las líneas: los calcula la base
  oportunidades: {
    table: "oportunidades",
    view: "oportunidades_resumen",
    writable: [
      "cliente_id",
      "productos",
      "canal_id",
      "descripcion",
      "etapa",
      "probabilidad",
      "resultado",
      "fecha_cierre_estimada",
      // Al cerrar se elige; vacía, la base pone hoy (y la borra si se reabre)
      "fecha_cierre",
      "motivo_perdida_tipo",
      "motivo_perdida",
      "asignados",
    ],
    busqueda: "sin_tildes",
    variosResponsables: true,
    lineasProductos: true,
  },
  // Pedidos: el estado, el origen y la clave los maneja la base
  // (pedido_cambiar_estado); el título y el total salen de las líneas
  pedidos: {
    table: "pedidos",
    view: "pedidos_resumen",
    writable: [
      "cliente_id",
      "tipo_entrega",
      "direccion",
      "entrega_en",
      "productos",
      "nota",
    ],
    busqueda: "sin_tildes",
    lineasProductos: true,
  },
  // Cada cambio de estado de un pedido; solo lectura
  pedido_historial: {
    table: "pedido_historial",
    writable: [],
  },
  // Módulo Ventas: las mismas oportunidades, solo lectura (la base muestra las
  // cerradas a quien tiene el módulo aunque no tenga Tablero)
  ventas: {
    table: "oportunidades",
    view: "oportunidades_resumen",
    writable: [],
    busqueda: "sin_tildes",
    variosResponsables: true,
    lineasProductos: true,
  },
  actividades: {
    table: "actividades",
    view: "actividades_resumen",
    writable: [
      "tipo",
      "cliente_id",
      "oportunidad_id",
      "titulo",
      "descripcion",
      "fecha",
      "completada",
      "asignados",
    ],
    busqueda: "sin_tildes",
    variosResponsables: true,
  },
  usuarios: {
    table: "usuarios",
    writable: ["nombre", "apellido"],
    busqueda: "minusculas",
  },
  auditoria: {
    table: "auditoria",
    view: "auditoria_resumen",
    writable: [],
    busqueda: "sin_tildes",
  },
  // Estado y versión publicada solo cambian por landing_publicar / landing_despublicar
  landings: {
    table: "landings",
    writable: ["nombre", "slug", "borrador"],
  },
};

const BUCKET_IMAGENES_LANDING = "landing-imagenes";

/** Lo que falta para publicar, con el mismo criterio que muestra el editor. */
export class LandingNoLista extends Error {
  constructor(readonly problems: string[]) {
    super("landing_no_lista");
  }
}

const MENSAJE_DOCUMENTO_DUPLICADO = "Ya existe un cliente con ese documento";
const MENSAJE_SIN_PERMISO = "No tenés permiso para realizar esta acción";
const MENSAJE_ETIQUETA_DUPLICADA = "Ya existe una etiqueta con ese nombre";
const MENSAJE_PRODUCTO_DUPLICADO = "Ya existe un producto con ese nombre";
const MENSAJE_CANAL_DUPLICADO = "Ya existe un canal con ese nombre";

interface PostgrestErrorBody {
  code?: string;
  message?: string;
  details?: string;
}

const traducirError = (error: unknown): unknown => {
  if (!(error instanceof HttpError)) return error;
  const body = (error.body ?? {}) as PostgrestErrorBody;
  const texto = `${body.message ?? ""} ${body.details ?? ""}`;

  if (body.code === "23505" && texto.includes("landings_slug_key")) {
    return new HttpError("Ya existe una landing con esa dirección", 409, {
      ...body,
      errors: { slug: "Ya existe una landing con esa dirección" },
    });
  }
  if (body.code === "23505" && texto.includes("etiquetas_nombre_key")) {
    return new HttpError(MENSAJE_ETIQUETA_DUPLICADA, 409, {
      ...body,
      errors: { nombre: MENSAJE_ETIQUETA_DUPLICADA },
    });
  }
  if (body.code === "23505" && texto.includes("productos_nombre_key")) {
    return new HttpError(MENSAJE_PRODUCTO_DUPLICADO, 409, {
      ...body,
      errors: { nombre: MENSAJE_PRODUCTO_DUPLICADO },
    });
  }
  if (body.code === "23505" && texto.includes("canales_nombre_key")) {
    return new HttpError(MENSAJE_CANAL_DUPLICADO, 409, {
      ...body,
      errors: { nombre: MENSAJE_CANAL_DUPLICADO },
    });
  }
  if (body.code === "23505" && texto.includes("clientes_documento_key")) {
    return new HttpError(MENSAJE_DOCUMENTO_DUPLICADO, 409, {
      ...body,
      errors: { documento: MENSAJE_DOCUMENTO_DUPLICADO },
    });
  }
  if (body.code === "23514" && texto.includes("clientes_documento")) {
    return new HttpError("El documento no es válido", 400, {
      ...body,
      errors: { documento: "El documento no es válido" },
    });
  }
  if (body.code === "42501") {
    return new HttpError(body.message || MENSAJE_SIN_PERMISO, 403, body);
  }
  // Reglas de la base con mensaje propio (producto en uso, inactivo…)
  if (
    (body.code === "23503" || body.code === "23514") &&
    body.message &&
    !texto.includes("constraint")
  ) {
    return new HttpError(body.message, 409, body);
  }
  if (body.code === "23503") {
    return new HttpError(
      "El registro está vinculado a otros datos y no se puede modificar así",
      409,
      body,
    );
  }
  return error;
};

const guard = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw traducirError(error);
  }
};

/** Quita caracteres que PostgREST interpreta dentro de un filtro o de un LIKE. */
const sanearBusqueda = (termino: string): string =>
  termino
    .replace(/[,()*"%_:\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sinTildes = (texto: string): string =>
  texto.normalize("NFD").replace(/\p{M}/gu, "");

/** `asignado_a: id` → `asignados@cs: {id}` (la lista contiene a esa persona). */
const aFiltroResponsables = (
  resource: string,
  filter: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const { asignado_a: responsable, ...resto } = filter ?? {};
  if (!RESOURCES[resource]?.variosResponsables) return filter ?? {};
  return typeof responsable === "string" && responsable
    ? { ...resto, "asignados@cs": `{${responsable}}` }
    : resto;
};

/** `etiquetas: 3` → `etiquetas@cs: {3}` (la lista contiene ese valor). */
const aFiltroListas = (
  resource: string,
  filter: Record<string, unknown>,
): Record<string, unknown> => {
  const listas = RESOURCES[resource]?.listas ?? [];
  if (!listas.length) return filter;
  return Object.fromEntries(
    Object.entries(filter).map(([clave, valor]) =>
      listas.includes(clave) &&
      (typeof valor === "number" || (typeof valor === "string" && valor))
        ? [`${clave}@cs`, `{${valor}}`]
        : [clave, valor],
    ),
  );
};

/** `producto_id: 3` → `productos@cs: [{"producto_id":3}]` (alguna línea con ese producto). */
const aFiltroProducto = (
  resource: string,
  filter: Record<string, unknown>,
): Record<string, unknown> => {
  const { producto_id: producto, ...resto } = filter;
  if (!RESOURCES[resource]?.lineasProductos) return filter;
  const id = Number(producto);
  return producto !== undefined && producto !== "" && Number.isInteger(id)
    ? { ...resto, "productos@cs": JSON.stringify([{ producto_id: id }]) }
    : resto;
};

/** `tipo_entrega: "coordinar"` → `tipo_entrega@is: null` (pedidos sin tipo de entrega). */
const aFiltroEntrega = (
  resource: string,
  filter: Record<string, unknown>,
): Record<string, unknown> => {
  if (resource !== "pedidos" || filter.tipo_entrega !== "coordinar") {
    return filter;
  }
  const { tipo_entrega: _coordinar, ...resto } = filter;
  return { ...resto, "tipo_entrega@is": null };
};

/**
 * Traduce el filtro `q` a `busqueda@ilike` (cada palabra debe aparecer) y el de
 * responsable a la lista de responsables, donde corresponde.
 */
const aFiltroApi = (
  resource: string,
  filter: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const { q, ...resto } = aFiltroEntrega(
    resource,
    aFiltroProducto(
      resource,
      aFiltroListas(resource, aFiltroResponsables(resource, filter)),
    ),
  );
  const modo = RESOURCES[resource]?.busqueda;
  if (typeof q !== "string" || !modo) return resto;

  let termino = sanearBusqueda(q).toLowerCase();
  if (modo === "sin_tildes") termino = sinTildes(termino);
  // Documentos y teléfonos se escriben con puntos, guiones o espacios: se busca por dígitos
  if (/^[\d.\-\s]+$/.test(termino) && termino.replace(/\D/g, "").length >= 3) {
    termino = termino.replace(/\D/g, "");
  }
  return termino ? { ...resto, "busqueda@ilike": termino } : resto;
};

const soloEscribibles = (
  resource: string,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const columnas = RESOURCES[resource]?.writable ?? [];
  return Object.fromEntries(
    Object.entries(data).filter(([clave]) => columnas.includes(clave)),
  );
};

const nombreLectura = (resource: string): string =>
  RESOURCES[resource]?.view ?? RESOURCES[resource]?.table ?? resource;
const nombreEscritura = (resource: string): string =>
  RESOURCES[resource]?.table ?? resource;

const mensajeDeFuncion = async (error: unknown): Promise<HttpError> => {
  const contexto = (error as { context?: Response } | null)?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const cuerpo = (await contexto.json()) as {
        message?: string;
        code?: string;
      };
      return new HttpError(
        cuerpo.message ?? "No se pudo completar la operación",
        contexto.status,
        cuerpo,
      );
    } catch {
      // Respuesta sin JSON: cae al mensaje genérico
    }
  }
  return new HttpError("No se pudo conectar con el servidor", 500);
};

export interface CrmDataProvider extends DataProvider {
  /** Llama a una función SQL (security invoker: aplica RLS del usuario). */
  rpc<T>(funcion: string, args?: Record<string, unknown>): Promise<T>;
  crearUsuario(datos: NuevoUsuario): Promise<Usuario>;
  actualizarUsuario(cambios: CambiosUsuario): Promise<Usuario>;
  /** Valida el borrador guardado y lo publica; LandingNoLista si falta algo. */
  publicarLanding(id: Identifier): Promise<Landing>;
  despublicarLanding(id: Identifier): Promise<Landing>;
  estadisticasLanding(
    id: Identifier,
    dias: number,
  ): Promise<LandingEstadisticas>;
  indicadoresLandings(dias: number): Promise<LandingIndicadores[]>;
  /** Cambia el estado de un pedido (`pedido_cambiar_estado`); el motivo es obligatorio al revertir una entrega. */
  cambiarEstadoPedido(
    id: Identifier,
    estado: EstadoPedido,
    motivo?: string,
  ): Promise<Pedido>;
  /** Sube una imagen pública y devuelve su URL. */
  subirImagenLanding(archivo: File): Promise<string>;
}

const ORDEN_ASC = "asc";
const ORDEN_DESC = "desc.nullslast";

/**
 * Suma el id como desempate: con valores repetidos (misma fecha, mismo
 * estado) el orden no es fijo y una fila puede repetirse o saltearse entre
 * páginas. ra-data-postgrest arma `order=<campo>.<sentido>`: el sentido va
 * dentro del campo y el id queda último, ascendente.
 */
function conDesempate(sort: SortPayload): SortPayload;
function conDesempate(sort: SortPayload | undefined): SortPayload | undefined;
function conDesempate(sort: SortPayload | undefined) {
  if (!sort?.field || sort.field === "id") return sort;
  const sentido = sort.order === "DESC" ? ORDEN_DESC : ORDEN_ASC;
  return { field: `${sort.field}.${sentido},id`, order: "ASC" };
}

export const getDataProvider = (): CrmDataProvider => {
  const client = getSupabaseClient();
  const base = supabaseDataProvider({
    instanceUrl: import.meta.env.VITE_SUPABASE_URL,
    apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
    supabaseClient: client,
    sortOrder: `${ORDEN_ASC},${ORDEN_DESC}` as never,
  });

  /** Relee el registro desde la vista para devolver también los nombres resueltos. */
  const releer = async <T extends RaRecord>(
    resource: string,
    id: Identifier,
    fallback: T,
  ): Promise<T> => {
    if (!RESOURCES[resource]?.view) return fallback;
    const { data } = await base.getOne<T>(nombreLectura(resource), { id });
    return data;
  };

  const invocarUsuarios = async <T>(
    method: "POST" | "PATCH",
    body: object,
  ): Promise<T> => {
    const { data, error } = await client.functions.invoke<{ data: T }>(
      "users",
      {
        method,
        body,
      },
    );
    if (error || !data) throw await mensajeDeFuncion(error);
    return data.data;
  };

  const rpc = async <T>(
    funcion: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    const { data, error } = await client.rpc(funcion, args);
    if (error) {
      throw new HttpError(
        error.message,
        error.code === "42501" ? 403 : 400,
        error,
      );
    }
    return data as T;
  };

  return {
    ...base,
    getList: (resource: string, params: GetListParams) =>
      guard(() =>
        base.getList(nombreLectura(resource), {
          ...params,
          sort: conDesempate(params.sort),
          filter: aFiltroApi(resource, params.filter),
        }),
      ),
    getOne: (resource: string, params: GetOneParams) =>
      guard(() => base.getOne(nombreLectura(resource), params)),
    getMany: (resource: string, params: GetManyParams) =>
      guard(() => base.getMany(nombreLectura(resource), params)),
    getManyReference: (resource: string, params: GetManyReferenceParams) =>
      guard(() =>
        base.getManyReference(nombreLectura(resource), {
          ...params,
          sort: conDesempate(params.sort),
          filter: aFiltroApi(resource, params.filter),
        }),
      ),
    create: (resource: string, params: CreateParams) =>
      guard(async () => {
        const { data } = await base.create(nombreEscritura(resource), {
          ...params,
          data: soloEscribibles(resource, params.data),
        });
        return { data: await releer(resource, data.id, data) };
      }),
    update: (resource: string, params: UpdateParams) =>
      guard(async () => {
        const { data } = await base.update(nombreEscritura(resource), {
          ...params,
          data: soloEscribibles(resource, params.data),
        });
        return { data: await releer(resource, data.id, data) };
      }),
    updateMany: (resource: string, params: UpdateManyParams) =>
      guard(() =>
        base.updateMany(nombreEscritura(resource), {
          ...params,
          data: soloEscribibles(resource, params.data),
        }),
      ),
    delete: (resource: string, params: DeleteParams) =>
      guard(() => base.delete(nombreEscritura(resource), params)),
    deleteMany: (resource: string, params: DeleteManyParams) =>
      guard(() => base.deleteMany(nombreEscritura(resource), params)),

    rpc,
    crearUsuario: (datos) => invocarUsuarios<Usuario>("POST", datos),
    actualizarUsuario: (cambios) => invocarUsuarios<Usuario>("PATCH", cambios),

    async publicarLanding(id) {
      // Lo guardado, no lo que tenga la pantalla: es lo que se va a publicar
      const { data: landing } = await base.getOne<Landing>("landings", {
        id: Number(id),
      });
      const problems: string[] = findPublishProblems(
        normalizeLandingContent(landing.borrador),
      );
      if (!isValidSlug(landing.slug)) problems.push("slug_invalid");
      if (problems.length) throw new LandingNoLista(problems);
      return rpc<Landing>("landing_publicar", { p_id: id });
    },
    despublicarLanding: (id) =>
      rpc<Landing>("landing_despublicar", { p_id: id }),
    estadisticasLanding: (id, dias) =>
      rpc<LandingEstadisticas>("landing_estadisticas", {
        p_landing_id: id,
        p_dias: dias,
      }),
    indicadoresLandings: (dias) =>
      rpc<LandingIndicadores[]>("landings_indicadores", { p_dias: dias }),
    cambiarEstadoPedido: (id, estado, motivo) =>
      rpc<Pedido>("pedido_cambiar_estado", {
        p_id: id,
        p_estado: estado,
        p_motivo: motivo?.trim() || null,
      }),
    async subirImagenLanding(archivo) {
      const extension =
        archivo.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "png";
      const ruta = `${crypto.randomUUID()}.${extension}`;
      const storage = client.storage.from(BUCKET_IMAGENES_LANDING);
      const { error } = await storage.upload(ruta, archivo, {
        contentType: archivo.type,
      });
      if (error) throw new HttpError(error.message, 400, error);
      return storage.getPublicUrl(ruta).data.publicUrl;
    },
  };
};

export const useCrmDataProvider = (): CrmDataProvider =>
  useDataProvider<CrmDataProvider>();
