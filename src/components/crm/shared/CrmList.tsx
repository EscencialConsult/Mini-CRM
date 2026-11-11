import {
  ListBase,
  RecordContextProvider,
  useListContext,
  type RaRecord,
  type SortPayload,
} from "ra-core";
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { ListPagination } from "@/components/admin/list-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { ListSearch } from "./ListControls";

export interface ColumnaLista<T extends RaRecord> {
  id: string;
  encabezado: string;
  /** Campo de la API por el que ordena al tocar el encabezado. */
  orden?: string;
  celda: (registro: T) => ReactNode;
  /** Etiqueta en la tarjeta (móvil). Sin ella, la columna no aparece en tarjetas. */
  etiquetaTarjeta?: string;
  alinear?: "izquierda" | "derecha";
  /** Columna cuyo contenido abre el registro (por defecto, la primera). */
  enlace?: boolean;
}

interface CrmListProps<T extends RaRecord> {
  resource: string;
  titulo: string;
  sort: SortPayload;
  perPage?: number;
  filterDefaultValues?: Record<string, unknown>;
  /** Botones a la derecha del título. */
  acciones?: ReactNode;
  /** Controles de filtro junto al buscador. */
  filtros?: ReactNode;
  /** Placeholder del buscador; sin él no se muestra. */
  buscar?: string;
  columnas: ColumnaLista<T>[];
  /** Título de la tarjeta (móvil) y texto del enlace accesible de la fila. */
  tituloFila: (registro: T) => ReactNode;
  /** Destino al abrir una fila; sin él las filas no son navegables. */
  hrefDe?: (registro: T) => string;
  /** Controles de la fila en la tarjeta móvil (la tabla los tiene como columna). */
  accionesTarjeta?: (registro: T) => ReactNode;
  vacio: string;
}

const ListaContenido = <T extends RaRecord>({
  columnas,
  tituloFila,
  hrefDe,
  vacio,
  accionesTarjeta,
}: Pick<
  CrmListProps<T>,
  "columnas" | "tituloFila" | "hrefDe" | "vacio" | "accionesTarjeta"
>) => {
  const {
    data,
    isPending,
    isPlaceholderData,
    error,
    sort,
    setSort,
    filterValues,
    refetch,
  } = useListContext<T>();
  const navigate = useNavigate();
  const indiceEnlace = Math.max(
    0,
    columnas.findIndex((columna) => columna.enlace),
  );

  // Mientras llega la respuesta de un filtro nuevo no se muestran los datos del anterior
  if (isPending || isPlaceholderData) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando">
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton key={indice} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
      >
        <p>No se pudieron cargar los datos. Probá de nuevo.</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data?.length) {
    const hayFiltros = Object.keys(filterValues).length > 0;
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {hayFiltros ? "No hay resultados para esos filtros." : vacio}
      </p>
    );
  }

  const alternarOrden = (campo: string) =>
    setSort({
      field: campo,
      order: sort.field === campo && sort.order === "ASC" ? "DESC" : "ASC",
    });

  return (
    <>
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columnas.map((columna) => {
                const ordenada = columna.orden === sort.field;
                const Icono = !ordenada
                  ? ArrowUpDown
                  : sort.order === "ASC"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <TableHead
                    key={columna.id}
                    scope="col"
                    aria-sort={
                      ordenada
                        ? sort.order === "ASC"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      columna.alinear === "derecha" && "text-right",
                    )}
                  >
                    {columna.orden ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(columna.orden as string)}
                        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {columna.encabezado}
                        <Icono
                          aria-hidden
                          className={cn("size-3.5", !ordenada && "opacity-40")}
                        />
                      </button>
                    ) : (
                      columna.encabezado
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((registro) => (
              <RecordContextProvider key={registro.id} value={registro}>
                <TableRow
                  className={cn(hrefDe && "cursor-pointer")}
                  onClick={
                    hrefDe ? () => navigate(hrefDe(registro)) : undefined
                  }
                >
                  {columnas.map((columna, indice) => (
                    <TableCell
                      key={columna.id}
                      className={cn(
                        columna.alinear === "derecha" && "text-right",
                      )}
                    >
                      {indice === indiceEnlace && hrefDe ? (
                        <Link
                          to={hrefDe(registro)}
                          onClick={(evento) => evento.stopPropagation()}
                          className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {columna.celda(registro)}
                        </Link>
                      ) : (
                        columna.celda(registro)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </RecordContextProvider>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ul className="space-y-3 md:hidden">
        {data.map((registro) => (
          <RecordContextProvider key={registro.id} value={registro}>
            <li>
              <Card className="py-4">
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-medium">
                      {hrefDe ? (
                        <Link to={hrefDe(registro)} className="hover:underline">
                          {tituloFila(registro)}
                        </Link>
                      ) : (
                        tituloFila(registro)
                      )}
                    </div>
                    {accionesTarjeta?.(registro)}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {columnas
                      .filter((columna) => columna.etiquetaTarjeta)
                      .map((columna) => (
                        <div key={columna.id} className="min-w-0">
                          <dt className="text-xs text-muted-foreground">
                            {columna.etiquetaTarjeta}
                          </dt>
                          <dd className="truncate text-sm">
                            {columna.celda(registro) ?? "—"}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </CardContent>
              </Card>
            </li>
          </RecordContextProvider>
        ))}
      </ul>
    </>
  );
};

const Barra = ({
  buscar,
  filtros,
}: Pick<CrmListProps<RaRecord>, "buscar" | "filtros">) => {
  const { filterValues, setFilters } = useListContext();
  const [reinicio, setReinicio] = useState(0);
  const hayFiltros = Object.keys(filterValues).length > 0;

  if (!buscar && !filtros) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {buscar && <ListSearch key={reinicio} placeholder={buscar} />}
      {filtros}
      {hayFiltros && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters({}, {});
            setReinicio((valor) => valor + 1);
          }}
        >
          <FilterX />
          Limpiar
        </Button>
      )}
    </div>
  );
};

/**
 * Página de listado estándar: título y acciones, buscador y filtros, tabla en
 * escritorio / tarjetas en móvil (sin scroll horizontal) y paginación.
 * Los filtros se guardan en el navegador, no en la URL (la URL se reserva
 * para el modal del registro).
 */
export const CrmList = <T extends RaRecord>({
  resource,
  titulo,
  sort,
  perPage = 25,
  filterDefaultValues,
  acciones,
  filtros,
  buscar,
  columnas,
  tituloFila,
  hrefDe,
  accionesTarjeta,
  vacio,
}: CrmListProps<T>) => (
  <ListBase
    resource={resource}
    perPage={perPage}
    sort={sort}
    filterDefaultValues={filterDefaultValues}
    disableSyncWithLocation
    storeKey={`${resource}.listParams`}
  >
    <section className="space-y-4 py-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {acciones && <div className="flex items-center gap-2">{acciones}</div>}
      </header>
      <Barra buscar={buscar} filtros={filtros} />
      <ListaContenido<T>
        columnas={columnas}
        tituloFila={tituloFila}
        hrefDe={hrefDe}
        accionesTarjeta={accionesTarjeta}
        vacio={vacio}
      />
      <ListPagination className="justify-center! flex-wrap pb-2" />
    </section>
  </ListBase>
);
