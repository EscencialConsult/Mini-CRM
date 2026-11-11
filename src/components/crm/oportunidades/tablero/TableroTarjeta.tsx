import { Draggable } from "@hello-pangea/dnd";
import { CalendarClock, UserRound } from "lucide-react";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatFecha, formatMoneda, hoyIso } from "../../domain/format";
import type { Oportunidad } from "../../domain/types";

interface TableroTarjetaProps {
  oportunidad: Oportunidad;
  indice: number;
  arrastreDeshabilitado: boolean;
  /** Su cambio de etapa se está guardando: no se puede volver a mover. */
  guardando: boolean;
}

/** Una oportunidad en el tablero: qué se vende, a quién, cuánto y cuándo. */
export const TableroTarjeta = ({
  oportunidad,
  indice,
  arrastreDeshabilitado,
  guardando,
}: TableroTarjetaProps) => {
  const cierre = oportunidad.fecha_cierre_estimada;
  const vencida = !!cierre && cierre < hoyIso();

  return (
    <Draggable
      draggableId={String(oportunidad.id)}
      index={indice}
      isDragDisabled={arrastreDeshabilitado || guardando}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          aria-busy={guardando || undefined}
        >
          <Card
            className={cn(
              "gap-0 py-3 transition-[box-shadow,opacity] duration-200",
              snapshot.isDragging ? "rotate-1 shadow-lg" : "shadow-sm",
              guardando && "opacity-60",
            )}
          >
            <CardContent className="flex flex-col gap-1.5 px-3 text-sm">
              <Link
                to={`/oportunidades/${oportunidad.id}`}
                className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {oportunidad.producto_servicio}
              </Link>
              {oportunidad.cliente_nombre && (
                <span className="truncate text-muted-foreground">
                  {oportunidad.cliente_nombre}
                </span>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold tabular-nums">
                  {formatMoneda(oportunidad.importe_estimado)}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {oportunidad.probabilidad} %
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {cierre && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      vencida && "font-medium text-destructive",
                    )}
                  >
                    <CalendarClock aria-hidden className="size-3.5" />
                    {formatFecha(cierre)}
                    {vencida && " · vencida"}
                  </span>
                )}
                <span className="inline-flex min-w-0 items-center gap-1">
                  <UserRound aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {oportunidad.asignado_nombre ?? "Sin asignar"}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
};
