import {
  Draggable,
  type DraggableStateSnapshot,
  type DraggingStyle,
  type NotDraggingStyle,
} from "@hello-pangea/dnd";
import {
  CalendarClock,
  CircleX,
  Ellipsis,
  SquarePen,
  Trophy,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { formatFecha, formatMoneda, hoyIso } from "../../domain/format";
import type { Oportunidad } from "../../domain/types";
import { PREFIJO_CIERRE, type Cierre } from "./cierre";

/** Soltada en Ganada o Perdida: sin animación de vuelta (se abre el diálogo). */
const estiloArrastre = (
  estilo: DraggingStyle | NotDraggingStyle | undefined,
  snapshot: DraggableStateSnapshot,
) =>
  snapshot.isDropAnimating && snapshot.draggingOver?.startsWith(PREFIJO_CIERRE)
    ? { ...estilo, transitionDuration: "0.001s" }
    : estilo;

const MenuTarjeta = ({
  oportunidad,
  alCerrar,
}: {
  oportunidad: Oportunidad;
  alCerrar: (oportunidad: Oportunidad, resultado: Cierre) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mr-1.5 -mt-1 size-7 shrink-0 text-muted-foreground"
        aria-label={`Acciones de ${oportunidad.producto_servicio}`}
      >
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => alCerrar(oportunidad, "ganada")}>
        <Trophy className="text-success" />
        Marcar ganada
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => alCerrar(oportunidad, "perdida")}>
        <CircleX className="text-destructive" />
        Marcar perdida
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to={`/oportunidades/${oportunidad.id}`}>
          <SquarePen />
          Abrir
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

interface TableroTarjetaProps {
  oportunidad: Oportunidad;
  indice: number;
  arrastreDeshabilitado: boolean;
  /** Su cambio de etapa se está guardando: no se puede volver a mover. */
  guardando: boolean;
  /** Cerrar desde el menú ⋯; sin él (no puede editar), no hay menú. */
  alCerrar?: (oportunidad: Oportunidad, resultado: Cierre) => void;
}

/** Una oportunidad en el tablero: qué se vende, a quién, cuánto y cuándo. */
export const TableroTarjeta = ({
  oportunidad,
  indice,
  arrastreDeshabilitado,
  guardando,
  alCerrar,
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
          style={estiloArrastre(provided.draggableProps.style, snapshot)}
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
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/oportunidades/${oportunidad.id}`}
                  className="min-w-0 font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {oportunidad.producto_servicio}
                </Link>
                {alCerrar && !guardando && (
                  <MenuTarjeta oportunidad={oportunidad} alCerrar={alCerrar} />
                )}
              </div>
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
