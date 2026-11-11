import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type { GetInfiniteListResult, Identifier } from "ra-core";

import type { Etapa, Oportunidad } from "../../domain/types";

type DatosColumna = InfiniteData<GetInfiniteListResult<Oportunidad>, number>;

/** Las consultas de las columnas: `["oportunidades", "getInfiniteList", { filter, … }]`. */
const CLAVE_COLUMNAS: QueryKey = ["oportunidades", "getInfiniteList"];

const etapaDeConsulta = (clave: QueryKey): string | undefined => {
  const parametros = clave[2];
  if (typeof parametros !== "object" || parametros === null) return undefined;
  if (!("filter" in parametros)) return undefined;
  const { filter } = parametros;
  return typeof filter === "object" &&
    filter !== null &&
    "etapa" in filter &&
    typeof filter.etapa === "string"
    ? filter.etapa
    : undefined;
};

const cantidadCargada = (datos: DatosColumna) =>
  datos.pages.reduce((suma, pagina) => suma + pagina.data.length, 0);

const agregar = (
  datos: DatosColumna,
  oportunidad: Oportunidad,
): DatosColumna => ({
  ...datos,
  pages: datos.pages.map((pagina, indice) => ({
    ...pagina,
    // Va primera: el orden es por última actualización
    data:
      indice === 0
        ? [
            oportunidad,
            ...pagina.data.filter((otra) => otra.id !== oportunidad.id),
          ]
        : pagina.data.filter((otra) => otra.id !== oportunidad.id),
    total: (pagina.total ?? 0) + 1,
  })),
});

const quitar = (datos: DatosColumna, id: Identifier): DatosColumna => ({
  ...datos,
  pages: datos.pages.map((pagina) => ({
    ...pagina,
    data: pagina.data.filter((otra) => otra.id !== id),
    total: Math.max(0, (pagina.total ?? 0) - 1),
  })),
});

/**
 * Después de guardar el cambio de etapa, la oportunidad (como la devolvió el
 * servidor) pasa de una columna a otra en las consultas en pantalla, sin
 * volver a pedirlas. Solo se vuelve a pedir la columna de origen si le
 * quedaban páginas sin cargar: al quitar una, las siguientes se correrían.
 */
export const moverEntreColumnas = async (
  queryClient: QueryClient,
  oportunidad: Oportunidad,
  desde: Etapa,
  hacia: Etapa,
) => {
  const consultas = queryClient
    .getQueryCache()
    .findAll({ queryKey: CLAVE_COLUMNAS, type: "active" });
  const recargas: Promise<void>[] = [];

  consultas.forEach(({ queryKey }) => {
    const etapa = etapaDeConsulta(queryKey);
    const datos = queryClient.getQueryData<DatosColumna>(queryKey);
    if (!datos) return;
    if (etapa === hacia) {
      queryClient.setQueryData(queryKey, agregar(datos, oportunidad));
    } else if (etapa === desde) {
      const quedanPaginas =
        cantidadCargada(datos) < (datos.pages[0]?.total ?? 0);
      // Se quita antes de re-pedir: si el pedido falla, no queda en dos columnas
      queryClient.setQueryData(queryKey, quitar(datos, oportunidad.id));
      if (quedanPaginas) {
        recargas.push(queryClient.refetchQueries({ queryKey, exact: true }));
      }
    }
  });

  // El resto (listado, ficha del cliente, columnas con otros filtros) se pide al volver a mostrarse
  await Promise.all([
    ...recargas,
    queryClient.invalidateQueries({
      queryKey: ["oportunidades"],
      refetchType: "none",
      predicate: (consulta) => !consultas.includes(consulta),
    }),
    queryClient.invalidateQueries({ queryKey: ["panel"] }),
  ]);
};
