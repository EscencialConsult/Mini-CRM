import { useQuery } from "@tanstack/react-query";

import type { RecordatoriosConteo } from "../domain/types";
import { useCrmDataProvider } from "../providers/dataProvider";

const UN_MINUTO = 60 * 1000;
const CINCO_MINUTOS = 5 * UN_MINUTO;

/** Pendientes del usuario (vencidos y de hoy): una consulta liviana, refrescada de a ratos. */
export const useRecordatorios = () => {
  const dataProvider = useCrmDataProvider();
  const { data } = useQuery({
    queryKey: ["recordatorios"],
    queryFn: () =>
      dataProvider.rpc<RecordatoriosConteo>("recordatorios_conteo"),
    staleTime: UN_MINUTO,
    refetchInterval: CINCO_MINUTOS,
  });

  const conteo: RecordatoriosConteo = data ?? {
    actividades_vencidas: 0,
    actividades_hoy: 0,
    contactos_vencidos: 0,
    contactos_hoy: 0,
  };
  const total =
    conteo.actividades_vencidas +
    conteo.actividades_hoy +
    conteo.contactos_vencidos +
    conteo.contactos_hoy;

  return { conteo, total };
};
