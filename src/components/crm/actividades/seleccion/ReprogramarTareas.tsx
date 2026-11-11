import { addDays, format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

import { CalendarGrid } from "@/components/admin/calendar-grid";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import { plural } from "../../domain/format";
import type { Actividad } from "../../domain/types";
import { useCrmDataProvider } from "../../providers/dataProvider";
import { cuantas, type PropsAccionLote } from "./useAccionLote";

const diaLargo = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Pasa las tareas pendientes a otro día, cada una a su misma hora, en un
 * solo pedido.
 */
export const ReprogramarTareas = ({
  tareas,
  seleccionadas,
  enCurso,
  ejecutar,
}: PropsAccionLote & { tareas: Actividad[]; seleccionadas: number }) => {
  const dataProvider = useCrmDataProvider();
  const [abierto, setAbierto] = useState(false);
  if (tareas.length === 0) return null;

  const reprogramar = (dia: Date) => {
    setAbierto(false);
    void ejecutar("reprogramar", async () => {
      const cantidad = await dataProvider.rpc<number>(
        "reprogramar_actividades",
        {
          p_ids: tareas.map((tarea) => tarea.id),
          p_dia: format(dia, "yyyy-MM-dd"),
          p_zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      );
      return `${plural(cantidad, "tarea reprogramada", "tareas reprogramadas")} para el ${diaLargo.format(dia)}`;
    });
  };

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={enCurso === "reprogramar"}
          disabled={enCurso !== null}
        >
          <CalendarClock />
          Reprogramar{cuantas(tareas.length, seleccionadas)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => reprogramar(addDays(new Date(), 1))}
          >
            Mañana
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => reprogramar(addDays(new Date(), 7))}
          >
            En una semana
          </Button>
        </div>
        <Separator className="my-2" />
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          Otro día (cada una mantiene su hora)
        </p>
        <CalendarGrid onSelect={reprogramar} />
      </PopoverContent>
    </Popover>
  );
};
