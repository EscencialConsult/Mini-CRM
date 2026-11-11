import { useNotify, useUpdate } from "ra-core";

import { Checkbox } from "@/components/ui/checkbox";

import type { Actividad } from "../domain/types";
import { useRefrescarDatos } from "../shared/useRefrescarDatos";

/**
 * Marca una actividad como realizada. Actualización optimista: la pantalla
 * cambia al instante y vuelve atrás con un aviso si la base la rechaza.
 */
export const ActividadCheck = ({ actividad }: { actividad: Actividad }) => {
  const [actualizar] = useUpdate();
  const notify = useNotify();
  const refrescar = useRefrescarDatos();

  if (actividad.tipo === "nota") return null;

  return (
    <span
      className="inline-flex"
      onClick={(evento) => evento.stopPropagation()}
    >
      <Checkbox
        checked={actividad.completada}
        aria-label={
          actividad.completada
            ? "Marcar como pendiente"
            : "Marcar como realizada"
        }
        onCheckedChange={(valor) =>
          actualizar(
            "actividades",
            {
              id: actividad.id,
              data: { completada: valor === true },
              previousData: actividad,
            },
            {
              mutationMode: "optimistic",
              onError: () =>
                notify("No se pudo actualizar la actividad", { type: "error" }),
              onSettled: () => void refrescar(),
            },
          )
        }
      />
    </span>
  );
};
