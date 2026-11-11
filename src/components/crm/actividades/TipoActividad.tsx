import { TIPOS_ACTIVIDAD, nombreDe } from "../domain/options";
import type { TipoActividad } from "../domain/types";
import { ICONOS_ACTIVIDAD } from "./iconosActividad";

/** Icono + nombre del tipo de tarea. */
export const TipoActividadChip = ({ tipo }: { tipo: TipoActividad }) => {
  const Icono = ICONOS_ACTIVIDAD[tipo];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icono aria-hidden className="size-4 text-muted-foreground" />
      {nombreDe(TIPOS_ACTIVIDAD, tipo)}
    </span>
  );
};
