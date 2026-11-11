import { addDays, set } from "date-fns";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import { DateTimeInput } from "@/components/admin/date-time-input";
import { Button } from "@/components/ui/button";

import type { TipoActividad } from "../domain/types";

const ETIQUETA_FECHA: Record<TipoActividad, string> = {
  llamada: "Fecha y hora de la llamada",
  reunion: "Fecha y hora de la reunión",
  nota: "Fecha",
  tarea: "Vence",
};

const ATAJOS = [
  { etiqueta: "Hoy", dias: 0 },
  { etiqueta: "Mañana", dias: 1 },
  { etiqueta: "En una semana", dias: 7 },
] as const;

/** Fecha y hora, con atajos de día que conservan la hora elegida (o las 9:00). */
export const FechaTareaInput = ({ tipo }: { tipo: TipoActividad }) => {
  const { setValue } = useFormContext();
  const fecha = useWatch({ name: "fecha" }) as string | null | undefined;

  const irA = (dias: number) => {
    const actual = fecha ? new Date(fecha) : null;
    const dia = addDays(new Date(), dias);
    const nueva = set(dia, {
      hours: actual?.getHours() ?? 9,
      minutes: actual?.getMinutes() ?? 0,
      seconds: 0,
      milliseconds: 0,
    });
    setValue("fecha", nueva.toISOString(), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-2">
      <DateTimeInput
        source="fecha"
        label={ETIQUETA_FECHA[tipo]}
        validate={required()}
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Atajos de fecha">
        {ATAJOS.map((atajo) => (
          <Button
            key={atajo.dias}
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => irA(atajo.dias)}
          >
            {atajo.etiqueta}
          </Button>
        ))}
      </div>
    </div>
  );
};
