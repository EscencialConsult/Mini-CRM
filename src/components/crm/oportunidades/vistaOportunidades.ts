import { useStore } from "ra-core";

export type VistaOportunidades = "tablero" | "listado";

/** Se guarda en el navegador: cada uno vuelve a la vista que usó por última vez. */
export const useVistaOportunidades = () =>
  useStore<VistaOportunidades>("oportunidades.vista", "tablero");

/**
 * Las dos vistas comparten el guardado de búsqueda y filtros (es la clave con
 * la que CrmList guarda los del listado): cambiar de vista los conserva.
 */
export const CLAVE_FILTROS_OPORTUNIDADES = "oportunidades.listParams";
export const FILTROS_INICIALES_OPORTUNIDADES = { resultado: "abierta" };
export const BUSCAR_OPORTUNIDADES = "Buscar por producto o cliente";
