import { useQuery } from "@tanstack/react-query";

import type {
  EmbudoEtapa,
  PanelIndicadores,
  VentasPorMes,
} from "../domain/types";
import { useCrmDataProvider } from "../providers/dataProvider";
import type { RangoFechas } from "./periodos";

const TREINTA_SEGUNDOS = 30 * 1000;
const MESES_RESUMEN = 6;

// Cada sección del panel es su propia consulta: carga, falla y se refresca
// sin depender de las demás.

export const useIndicadores = ({ desde, hasta }: RangoFechas) => {
  const dataProvider = useCrmDataProvider();
  return useQuery({
    queryKey: ["panel", "indicadores", desde, hasta],
    queryFn: () =>
      dataProvider.rpc<PanelIndicadores>("panel_indicadores", {
        p_desde: desde,
        p_hasta: hasta,
      }),
    staleTime: TREINTA_SEGUNDOS,
  });
};

export const useVentasPorMes = () => {
  const dataProvider = useCrmDataProvider();
  return useQuery({
    queryKey: ["panel", "ventas-por-mes", MESES_RESUMEN],
    queryFn: () =>
      dataProvider.rpc<VentasPorMes[]>("panel_ventas_por_mes", {
        p_meses: MESES_RESUMEN,
      }),
    staleTime: TREINTA_SEGUNDOS,
  });
};

export const useEmbudo = () => {
  const dataProvider = useCrmDataProvider();
  return useQuery({
    queryKey: ["panel", "embudo"],
    queryFn: () => dataProvider.rpc<EmbudoEtapa[]>("panel_embudo"),
    staleTime: TREINTA_SEGUNDOS,
  });
};
