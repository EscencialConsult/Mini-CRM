import { useNotify } from "ra-core";
import { useState } from "react";

import { useRefrescarDatos } from "../../shared/useRefrescarDatos";

export type AccionLote =
  "completar" | "reabrir" | "reprogramar" | "reasignar" | "eliminar";

/** Lo que recibe cada acción de la barra de selección. */
export interface PropsAccionLote {
  /** Acción en curso: su botón muestra el spinner y los demás se bloquean. */
  enCurso: AccionLote | null;
  /**
   * Corre la acción (un pedido para todas las tareas): avisa con el mensaje
   * que devuelve, limpia la selección y refresca. Resuelve si salió bien.
   */
  ejecutar: (
    accion: AccionLote,
    tarea: () => Promise<string>,
  ) => Promise<boolean>;
}

/** " (3)" si la acción no alcanza a todas las seleccionadas. */
export const cuantas = (afectadas: number, seleccionadas: number) =>
  afectadas === seleccionadas ? "" : ` (${afectadas})`;

export const useAccionLote = (limpiar: () => void): PropsAccionLote => {
  const notify = useNotify();
  const refrescar = useRefrescarDatos();
  const [enCurso, setEnCurso] = useState<AccionLote | null>(null);

  const ejecutar: PropsAccionLote["ejecutar"] = async (accion, tarea) => {
    setEnCurso(accion);
    try {
      notify(await tarea(), { type: "success" });
      limpiar();
      void refrescar();
      return true;
    } catch (error) {
      notify(
        error instanceof Error && error.message
          ? error.message
          : "No se pudieron actualizar las tareas",
        { type: "error" },
      );
      return false;
    } finally {
      setEnCurso(null);
    }
  };

  return { enCurso, ejecutar };
};
