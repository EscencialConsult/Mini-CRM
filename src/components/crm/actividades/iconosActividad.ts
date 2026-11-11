import {
  ListChecks,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { TipoActividad } from "../domain/types";

export const ICONOS_ACTIVIDAD: Record<TipoActividad, LucideIcon> = {
  llamada: Phone,
  reunion: Users,
  nota: StickyNote,
  tarea: ListChecks,
};
