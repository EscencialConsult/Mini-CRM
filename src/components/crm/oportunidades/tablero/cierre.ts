/** Cómo se cierra una oportunidad desde el tablero. */
export type Cierre = "ganada" | "perdida";

/** Prefijo del `droppableId` de las zonas de cierre: no son etapas. */
export const PREFIJO_CIERRE = "cierre:";

export const cierreDeZona = (droppableId: string): Cierre | undefined => {
  const resultado = droppableId.slice(PREFIJO_CIERRE.length);
  return droppableId.startsWith(PREFIJO_CIERRE) &&
    (resultado === "ganada" || resultado === "perdida")
    ? resultado
    : undefined;
};
