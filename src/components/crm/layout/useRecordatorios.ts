import { useQuery } from "@tanstack/react-query";

import type { RecordatoriosConteo } from "../domain/types";
import { useModulos } from "../providers/authProvider";
import { useCrmDataProvider } from "../providers/dataProvider";

const UN_MINUTO = 60 * 1000;
const CINCO_MINUTOS = 5 * UN_MINUTO;

/**
 * Pendientes del usuario (vencidos y de hoy): una consulta liviana, refrescada
 * de a ratos. Tareas cuentan con el módulo Tareas y contactos con Clientes
 * (con Tablero también se leen clientes, pero no son su seguimiento).
 */
export const useRecordatorios = () => {
  const dataProvider = useCrmDataProvider();
  const { tiene } = useModulos();
  const conTareas = tiene("actividades");
  const conContactos = tiene("clientes");
  const { data } = useQuery({
    queryKey: ["recordatorios"],
    queryFn: () =>
      dataProvider.rpc<RecordatoriosConteo>("recordatorios_conteo"),
    staleTime: UN_MINUTO,
    refetchInterval: CINCO_MINUTOS,
    enabled: conTareas || conContactos,
  });

  const conteo: RecordatoriosConteo = {
    actividades_vencidas: conTareas ? (data?.actividades_vencidas ?? 0) : 0,
    actividades_hoy: conTareas ? (data?.actividades_hoy ?? 0) : 0,
    contactos_vencidos: conContactos ? (data?.contactos_vencidos ?? 0) : 0,
    contactos_hoy: conContactos ? (data?.contactos_hoy ?? 0) : 0,
  };
  const total =
    conteo.actividades_vencidas +
    conteo.actividades_hoy +
    conteo.contactos_vencidos +
    conteo.contactos_hoy;

  return { conteo, total, conTareas, conContactos };
};
