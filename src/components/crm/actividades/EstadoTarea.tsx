import { formatFechaHora } from "../domain/format";
import type { Actividad } from "../domain/types";
import { Pill } from "../shared/badges";
import { TipoActividadChip } from "./TipoActividad";

/** Estado de la tarea: completada (cuándo), vencida o pendiente. Las notas no tienen. */
export const EstadoTareaPill = ({ actividad }: { actividad: Actividad }) => {
  if (actividad.tipo === "nota") return null;
  if (actividad.completada) {
    return (
      <Pill tono="exito">
        Completada
        {actividad.completada_en &&
          ` el ${formatFechaHora(actividad.completada_en)}`}
      </Pill>
    );
  }
  return actividad.vencida ? (
    <Pill tono="peligro">Vencida</Pill>
  ) : (
    <Pill tono="info">Pendiente</Pill>
  );
};

/** Bajada del modal de una tarea: tipo, estado y cliente. */
export const ResumenTarea = ({ actividad }: { actividad: Actividad }) => (
  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <TipoActividadChip tipo={actividad.tipo} />
    <EstadoTareaPill actividad={actividad} />
    {actividad.cliente_nombre && (
      <span className="truncate">{actividad.cliente_nombre}</span>
    )}
  </span>
);
