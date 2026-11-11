import {
  ListChecks,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

import { TIPOS_ACTIVIDAD, nombreDe } from "../domain/options";
import type { TipoActividad } from "../domain/types";

const ICONOS_ACTIVIDAD: Record<TipoActividad, LucideIcon> = {
  llamada: Phone,
  reunion: Users,
  nota: StickyNote,
  tarea: ListChecks,
};

/** Icono + nombre del tipo de actividad. */
export const TipoActividadChip = ({ tipo }: { tipo: TipoActividad }) => {
  const Icono = ICONOS_ACTIVIDAD[tipo];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icono aria-hidden className="size-4 text-muted-foreground" />
      {nombreDe(TIPOS_ACTIVIDAD, tipo)}
    </span>
  );
};
