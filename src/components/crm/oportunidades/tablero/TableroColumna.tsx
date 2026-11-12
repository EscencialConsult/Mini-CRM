import { Droppable } from "@hello-pangea/dnd";
import { useInfiniteGetList, type Identifier, type SortPayload } from "ra-core";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { formatMoneda } from "../../domain/format";
import type { EtapaOpcion } from "../../domain/options";
import type { Oportunidad } from "../../domain/types";
import type { Cierre } from "./cierre";
import { aplicarMovimientos, type MovimientoPendiente } from "./movimientos";
import { TableroTarjeta } from "./TableroTarjeta";

const TAMANIO_PAGINA = 20;
// Lo último que se movió o editó, arriba: una tarjeta recién soltada queda a la vista
const ORDEN: SortPayload = { field: "actualizado_en", order: "DESC" };

interface TableroColumnaProps {
  etapa: EtapaOpcion;
  /** Búsqueda y filtros del tablero, sin etapa (la pone la columna). */
  filtro: Record<string, unknown>;
  pendientes: MovimientoPendiente[];
  arrastreDeshabilitado: boolean;
  /** Oportunidades cuyo cambio de etapa se está guardando. */
  enMovimiento: ReadonlySet<Identifier>;
  alCargar: (oportunidades: Oportunidad[]) => void;
  /** Cerrar desde el menú de la tarjeta; sin él (no puede editar), no hay menú. */
  alCerrar?: (oportunidad: Oportunidad, resultado: Cierre) => void;
}

/** Una etapa: sus oportunidades abiertas, de a 20, y su total. */
export const TableroColumna = ({
  etapa,
  filtro,
  pendientes,
  arrastreDeshabilitado,
  enMovimiento,
  alCargar,
  alCerrar,
}: TableroColumnaProps) => {
  const {
    data,
    total,
    isPending,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteGetList<Oportunidad>("oportunidades", {
    filter: { ...filtro, etapa: etapa.id },
    sort: ORDEN,
    pagination: { page: 1, perPage: TAMANIO_PAGINA },
  });
  // Una tarjeta recién llegada puede repetirse en la página siguiente: va una sola vez
  const cargadas = useMemo(() => {
    const vistas = new Set<Identifier>();
    return (data?.pages ?? [])
      .flatMap((pagina) => pagina.data)
      .filter((oportunidad) => {
        if (vistas.has(oportunidad.id)) return false;
        vistas.add(oportunidad.id);
        return true;
      });
  }, [data]);
  const hayMas = !!hasNextPage && cargadas.length < (total ?? 0);

  useEffect(() => {
    alCargar(cargadas);
  }, [cargadas, alCargar]);

  // Una tarjeta soltada aparece en su columna antes de que el servidor confirme
  const { oportunidades, total: totalVisible } = aplicarMovimientos(
    etapa.id,
    cargadas,
    total ?? 0,
    pendientes,
  );
  // La suma solo se muestra si están todas cargadas: si no, mentiría
  const importe = hayMas
    ? null
    : oportunidades.reduce(
        (suma, oportunidad) => suma + Number(oportunidad.importe_estimado),
        0,
      );
  const idTitulo = `tablero-${etapa.id}`;

  return (
    <section aria-labelledby={idTitulo} className="flex min-w-0 flex-col gap-2">
      <header className="flex items-baseline gap-2 px-1">
        <h2 id={idTitulo} className="truncate text-sm font-semibold">
          {etapa.name}
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {isPending ? "…" : totalVisible}
        </span>
        {!isPending && importe !== null && totalVisible > 0 && (
          <span className="ml-auto truncate text-xs tabular-nums text-muted-foreground">
            {formatMoneda(importe)}
          </span>
        )}
      </header>
      <Droppable droppableId={etapa.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-28 flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors",
              snapshot.isDraggingOver && "bg-muted",
            )}
          >
            {isPending ? (
              <div aria-busy="true" aria-label="Cargando" className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div role="alert" className="space-y-2 p-2 text-sm">
                <p className="text-destructive">
                  No se pudo cargar esta etapa.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void refetch()}
                >
                  Reintentar
                </Button>
              </div>
            ) : (
              oportunidades.map((oportunidad, indice) => (
                <TableroTarjeta
                  key={oportunidad.id}
                  oportunidad={oportunidad}
                  indice={indice}
                  arrastreDeshabilitado={arrastreDeshabilitado}
                  guardando={enMovimiento.has(oportunidad.id)}
                  alCerrar={alCerrar}
                />
              ))
            )}
            {provided.placeholder}
            {!isPending &&
              !error &&
              oportunidades.length === 0 &&
              !snapshot.isDraggingOver && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  Sin oportunidades en esta etapa.
                </p>
              )}
          </div>
        )}
      </Droppable>
      {hayMas && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Cargar más
        </Button>
      )}
    </section>
  );
};
