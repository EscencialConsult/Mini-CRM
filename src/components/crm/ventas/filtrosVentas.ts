import { useQuery } from "@tanstack/react-query";
import { useStore } from "ra-core";

import {
  PERIODOS,
  rangoDePeriodo,
  type Periodo,
  type PeriodoId,
} from "../dashboard/periodos";
import type { VentasReporte } from "../domain/types";
import { useCrmDataProvider } from "../providers/dataProvider";

export type PeriodoVentas = PeriodoId | "todo";

export const PERIODOS_VENTAS: { id: PeriodoVentas; name: string }[] = [
  ...PERIODOS,
  { id: "ultimos_12", name: "Últimos 12 meses" } satisfies Periodo,
  { id: "todo", name: "Todo el historial" },
];

/** Filtros de la sección: los comparten el listado y los reportes. */
export interface FiltrosVentas {
  periodo: PeriodoVentas;
  vendedor?: string;
  canal?: number;
  producto?: number;
}

const INICIALES: FiltrosVentas = { periodo: "anio" };

export const useFiltrosVentas = () =>
  useStore<FiltrosVentas>("ventas.filtros", INICIALES);

/** Rango de fechas de cierre del período ("todo": sin límites). */
export const rangoVentas = (periodo: PeriodoVentas) =>
  periodo === "todo" ? { desde: null, hasta: null } : rangoDePeriodo(periodo);

/** Los filtros como filtro del listado de ganadas (recurso `ventas`). */
export const filtroListado = (
  filtros: FiltrosVentas,
): Record<string, unknown> => {
  const { desde, hasta } = rangoVentas(filtros.periodo);
  return {
    resultado: "ganada",
    ...(desde && { "fecha_cierre@gte": desde }),
    ...(hasta && { "fecha_cierre@lte": hasta }),
    ...(filtros.vendedor && { asignado_a: filtros.vendedor }),
    ...(filtros.canal && { canal_id: filtros.canal }),
    ...(filtros.producto && { producto_id: filtros.producto }),
  };
};

const TREINTA_SEGUNDOS = 30 * 1000;

/** Todos los reportes en una consulta (`ventas_reporte`), con los mismos filtros. */
export const useVentasReporte = (filtros: FiltrosVentas) => {
  const dataProvider = useCrmDataProvider();
  const { desde, hasta } = rangoVentas(filtros.periodo);
  return useQuery({
    queryKey: ["ventas", "reporte", desde, hasta, filtros],
    queryFn: () =>
      dataProvider.rpc<VentasReporte>("ventas_reporte", {
        p_desde: desde,
        p_hasta: hasta,
        p_vendedor: filtros.vendedor ?? null,
        p_canal: filtros.canal ?? null,
        p_producto: filtros.producto ?? null,
      }),
    staleTime: TREINTA_SEGUNDOS,
  });
};
