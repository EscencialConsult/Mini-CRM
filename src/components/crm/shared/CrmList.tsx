import {
  ListBase,
  RecordContextProvider,
  useListContext,
  type RaRecord,
  type SortPayload,
} from "ra-core";
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { ListPagination } from "@/components/admin/list-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  BarraSeleccion,
  CasillaSeleccion,
  CasillaSeleccionTodas,
  type SeleccionLista,
} from "./SeleccionLista";

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

/** Una vista del listado (Pendientes, Completadas…): fija algunos filtros y su orden. */
export interface PestanaLista {
  id: string;
  etiqueta: string;
  /**
   * Filtros que la definen. Sus claves las maneja la pestaña: "Limpiar" no
   * las toca y una pestaña sin una clave la quita.
   */
  filtro: Record<string, unknown>;
  /** Orden con el que se abre (después se puede cambiar desde los encabezados). */
  orden: SortPayload;
  /** Texto cuando la pestaña está vacía sin otros filtros. */
  vacio?: string;
}

interface CrmListProps<T extends RaRecord> {
  resource: string;
  /** Sin título: la página ya tiene el suyo (el listado va dentro de una sección). */
  titulo?: string;
  sort: SortPayload;
  perPage?: number;
  filterDefaultValues?: Record<string, unknown>;
  /** Filtro fijo que la pantalla controla desde afuera (no se guarda ni se limpia). */
  filter?: Record<string, unknown>;
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
  /** Pestañas sobre el listado; la primera debe coincidir con filterDefaultValues y sort. */
  pestanas?: readonly PestanaLista[];
  /** Casillas para elegir varias filas y la barra con sus acciones. */
  seleccion?: SeleccionLista<T>;
}

/** Nombre accesible de la casilla de una fila. */
const etiquetaCasilla = (titulo: ReactNode) =>
  typeof titulo === "string" ? `Seleccionar «${titulo}»` : "Seleccionar";

const ListaContenido = <T extends RaRecord>({
  columnas,
  tituloFila,
  hrefDe,
  vacio,
  accionesTarjeta,
  seleccion,
  ocultos = [],
}: Pick<
  CrmListProps<T>,
  | "columnas"
  | "tituloFila"
  | "hrefDe"
  | "vacio"
  | "accionesTarjeta"
  | "seleccion"
> & {
  /** Filtros que no cuentan como "filtrado" (los de las pestañas). */
  ocultos?: readonly string[];
}) => {
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
    const hayFiltros = Object.keys(filterValues).some(
      (clave) => !ocultos.includes(clave),
    );
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
      {seleccion && <BarraSeleccion<T> seleccion={seleccion} />}
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {seleccion && (
                <TableHead className="w-10">
                  <CasillaSeleccionTodas />
                </TableHead>
              )}
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
                  {seleccion && (
                    <TableCell
                      className="w-10"
                      onClick={(evento) => evento.stopPropagation()}
                    >
                      <CasillaSeleccion
                        id={registro.id}
                        etiqueta={etiquetaCasilla(tituloFila(registro))}
                      />
                    </TableCell>
                  )}
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
                    <div className="flex min-w-0 items-start gap-3 font-medium">
                      {seleccion && (
                        <span className="flex h-6 items-center">
                          <CasillaSeleccion
                            id={registro.id}
                            etiqueta={etiquetaCasilla(tituloFila(registro))}
                          />
                        </span>
                      )}
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

interface BarraFiltrosProps extends Pick<
  CrmListProps<RaRecord>,
  "buscar" | "filtros"
> {
  /** Filtros guardados que esta vista no muestra: no cuentan para "Limpiar" y se conservan. */
  ocultos?: readonly string[];
}

/** Buscador, filtros y "Limpiar"; va dentro de un ListBase. */
export const BarraFiltros = ({
  buscar,
  filtros,
  ocultos = [],
}: BarraFiltrosProps) => {
  const { filterValues, setFilters } = useListContext();
  const [reinicio, setReinicio] = useState(0);
  const hayFiltros = Object.keys(filterValues).some(
    (clave) => !ocultos.includes(clave),
  );

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
            setFilters(
              Object.fromEntries(
                Object.entries(filterValues).filter(([clave]) =>
                  ocultos.includes(clave),
                ),
              ),
              {},
            );
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

type CuerpoListaProps<T extends RaRecord> = Pick<
  CrmListProps<T>,
  | "buscar"
  | "filtros"
  | "columnas"
  | "tituloFila"
  | "hrefDe"
  | "accionesTarjeta"
  | "vacio"
  | "pestanas"
  | "seleccion"
>;

/**
 * Buscador, filtros, tabla y paginación; con pestañas, todo eso va dentro de
 * la pestaña activa y los filtros de la barra se aplican sobre ella.
 */
const CuerpoLista = <T extends RaRecord>({
  pestanas,
  buscar,
  filtros,
  vacio,
  ...lista
}: CuerpoListaProps<T>) => {
  const {
    filterValues,
    displayedFilters,
    setFilters,
    setSort,
    onUnselectItems,
  } = useListContext<T>();
  const claves = useMemo(
    () => [
      ...new Set(pestanas?.flatMap((pestana) => Object.keys(pestana.filtro))),
    ],
    [pestanas],
  );

  const contenido = (textoVacio: string) => (
    <>
      <BarraFiltros buscar={buscar} filtros={filtros} ocultos={claves} />
      <ListaContenido<T> {...lista} vacio={textoVacio} ocultos={claves} />
      <ListPagination className="justify-center! flex-wrap pb-2" />
    </>
  );

  if (!pestanas?.length) return contenido(vacio);

  // La pestaña sale de los filtros guardados: al volver al listado sigue la misma
  const activa =
    pestanas.find((pestana) =>
      claves.every((clave) => filterValues[clave] === pestana.filtro[clave]),
    ) ?? pestanas[0];

  const elegir = (id: string) => {
    const pestana = pestanas.find((opcion) => opcion.id === id);
    if (!pestana || pestana.id === activa.id) return;
    const otros = Object.fromEntries(
      Object.entries(filterValues).filter(([clave]) => !claves.includes(clave)),
    );
    // Filtro y orden van en un mismo pedido (ra-core junta los cambios)
    setFilters({ ...otros, ...pestana.filtro }, displayedFilters);
    onUnselectItems();
    setSort(pestana.orden);
  };

  return (
    <Tabs value={activa.id} onValueChange={elegir} className="gap-4">
      <TabsList className="w-full sm:w-fit">
        {pestanas.map((pestana) => (
          <TabsTrigger key={pestana.id} value={pestana.id} className="px-3">
            {pestana.etiqueta}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={activa.id} className="space-y-4">
        {contenido(activa.vacio ?? vacio)}
      </TabsContent>
    </Tabs>
  );
};

/**
 * Página de listado estándar: título y acciones, pestañas opcionales,
 * buscador y filtros, tabla en escritorio / tarjetas en móvil (sin scroll
 * horizontal) y paginación. Los filtros se guardan en el navegador, no en la
 * URL (la URL se reserva para el modal del registro).
 */
export const CrmList = <T extends RaRecord>({
  resource,
  titulo,
  sort,
  perPage = 25,
  filterDefaultValues,
  filter,
  acciones,
  pestanas,
  ...cuerpo
}: CrmListProps<T>) => (
  <ListBase
    resource={resource}
    perPage={perPage}
    sort={sort}
    filterDefaultValues={filterDefaultValues}
    filter={filter}
    disableSyncWithLocation
    storeKey={`${resource}.listParams`}
  >
    <section className={cn("space-y-4", titulo && "py-2")}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-3">
          {titulo && (
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          )}
          {acciones && (
            <div className="ml-auto flex items-center gap-2">{acciones}</div>
          )}
        </header>
      )}
      <CuerpoLista<T> {...cuerpo} pestanas={pestanas} />
    </section>
  </ListBase>
);
