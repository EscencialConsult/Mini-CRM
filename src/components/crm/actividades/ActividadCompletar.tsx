import { Check, RotateCcw } from "lucide-react";
import { useNotify, useUpdate } from "ra-core";

import { Button } from "@/components/ui/button";

import type { Actividad } from "../domain/types";
import { useRefrescarDatos } from "../shared/useRefrescarDatos";

/**
 * Completar (o reabrir) una tarea desde una fila. Optimista: cambia al
 * instante y vuelve atrás con un aviso si la base lo rechaza. Las notas
 * siempre están completadas: no tienen botón.
 */
export const ActividadCompletar = ({ actividad }: { actividad: Actividad }) => {
  const [actualizar] = useUpdate();
  const notify = useNotify();
  const refrescar = useRefrescarDatos();

  if (actividad.tipo === "nota") return null;

  const completar = !actividad.completada;
  return (
    <Button
      type="button"
      size="sm"
      variant={completar ? "success-ghost" : "ghost"}
      className="shrink-0"
      onClick={(evento) => {
        evento.stopPropagation();
        actualizar(
          "actividades",
          {
            id: actividad.id,
            data: { completada: completar },
            previousData: actividad,
          },
          {
            mutationMode: "optimistic",
            onError: () =>
              notify("No se pudo actualizar la tarea", { type: "error" }),
            onSettled: () => void refrescar(),
          },
        );
      }}
    >
      {completar ? <Check /> : <RotateCcw />}
      {completar ? "Completar" : "Reabrir"}
    </Button>
  );
};
