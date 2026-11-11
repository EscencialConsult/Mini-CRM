import { ETAPAS, probabilidadDeEtapa } from "../../domain/options";
import type { Etapa, Oportunidad } from "../../domain/types";

export interface MovimientoPendiente {
  oportunidad: Oportunidad;
  desde: Etapa;
  hacia: Etapa;
}

export const esEtapa = (valor: string): valor is Etapa =>
  ETAPAS.some((etapa) => etapa.id === valor);

/**
 * Las tarjetas de una columna mientras se guardan los movimientos: las que
 * llegan van primero, las que se van se ocultan y el total acompaña.
 */
export const aplicarMovimientos = (
  etapa: Etapa,
  cargadas: Oportunidad[],
  total: number,
  pendientes: MovimientoPendiente[],
): { oportunidades: Oportunidad[]; total: number } => {
  const llegan = pendientes
    .filter((movimiento) => movimiento.hacia === etapa)
    .map((movimiento) => ({
      ...movimiento.oportunidad,
      etapa,
      probabilidad: probabilidadDeEtapa(etapa),
    }));
  const seVan = new Set(
    pendientes
      .filter((movimiento) => movimiento.desde === etapa)
      .map((movimiento) => movimiento.oportunidad.id),
  );
  const idsLlegan = new Set(llegan.map((oportunidad) => oportunidad.id));
  const idsCargadas = new Set(cargadas.map((oportunidad) => oportunidad.id));
  // Solo cuenta lo que la página cargada todavía no refleja
  const nuevas = llegan.filter(
    (oportunidad) => !idsCargadas.has(oportunidad.id),
  );
  const salientes = [...seVan].filter((id) => idsCargadas.has(id));
  return {
    oportunidades: [
      ...llegan,
      ...cargadas.filter(
        (oportunidad) =>
          !seVan.has(oportunidad.id) && !idsLlegan.has(oportunidad.id),
      ),
    ],
    total: total + nuevas.length - salientes.length,
  };
};
