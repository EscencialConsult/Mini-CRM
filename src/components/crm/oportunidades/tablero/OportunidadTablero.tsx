import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import {
  ListBase,
  useCanAccess,
  useDataProvider,
  useListContext,
  useNotify,
} from "ra-core";
import { useCallback, useMemo, useRef, useState } from "react";

import { ETAPAS, probabilidadDeEtapa } from "../../domain/options";
import type { Oportunidad } from "../../domain/types";
import { BarraFiltros } from "../../shared/CrmList";
import { FiltroSoloEmpresas } from "../../shared/ListControls";
import {
  AccionesOportunidades,
  FiltroResponsable,
} from "../ControlesOportunidades";
import {
  BUSCAR_OPORTUNIDADES,
  CLAVE_FILTROS_OPORTUNIDADES,
  FILTROS_INICIALES_OPORTUNIDADES,
} from "../vistaOportunidades";
import { moverEntreColumnas } from "./columnasEnCache";
import { esEtapa, type MovimientoPendiente } from "./movimientos";
import { TableroColumna } from "./TableroColumna";

/** Filtros del listado que el tablero no usa: las columnas ya son las etapas y solo hay abiertas. */
const FILTROS_DEL_LISTADO: readonly string[] = ["etapa", "resultado"];

const filtroDelTablero = (filtros: Record<string, unknown>) => ({
  ...Object.fromEntries(
    Object.entries(filtros).filter(
      ([clave]) => !FILTROS_DEL_LISTADO.includes(clave),
    ),
  ),
  resultado: "abierta",
});

/**
 * Una columna por etapa. Soltar una tarjeta en otra columna le cambia la etapa
 * (y la probabilidad sugerida): se mueve al instante y, si no se puede
 * guardar, vuelve a su lugar con un aviso.
 */
const Tablero = () => {
  const { filterValues } = useListContext();
  const filtro = useMemo(() => filtroDelTablero(filterValues), [filterValues]);
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { canAccess: puedeEditar } = useCanAccess({
    resource: "oportunidades",
    action: "edit",
  });
  const [pendientes, setPendientes] = useState<MovimientoPendiente[]>([]);
  const enMovimiento = useMemo(
    () => new Set(pendientes.map((pendiente) => pendiente.oportunidad.id)),
    [pendientes],
  );
  // Lo que cargaron las columnas: soltar una tarjeta no necesita otro pedido
  const cargadas = useRef(new Map<string, Oportunidad>());
  const registrar = useCallback((lista: Oportunidad[]) => {
    lista.forEach((oportunidad) =>
      cargadas.current.set(String(oportunidad.id), oportunidad),
    );
  }, []);

  const alSoltar: OnDragEndResponder = async ({
    destination,
    source,
    draggableId,
  }) => {
    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }
    const oportunidad = cargadas.current.get(draggableId);
    const desde = source.droppableId;
    const hacia = destination.droppableId;
    if (!oportunidad || !esEtapa(desde) || !esEtapa(hacia)) return;

    const movimiento: MovimientoPendiente = { oportunidad, desde, hacia };
    setPendientes((actuales) => [...actuales, movimiento]);
    try {
      const { data: guardada } = await dataProvider.update<Oportunidad>(
        "oportunidades",
        {
          id: oportunidad.id,
          data: { etapa: hacia, probabilidad: probabilidadDeEtapa(hacia) },
          previousData: oportunidad,
        },
      );
      await moverEntreColumnas(queryClient, guardada, desde, hacia);
    } catch (error) {
      notify(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cambiar la etapa",
        { type: "error" },
      );
    } finally {
      setPendientes((actuales) =>
        actuales.filter((pendiente) => pendiente !== movimiento),
      );
    }
  };

  return (
    <DragDropContext onDragEnd={alSoltar}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ETAPAS.map((etapa) => (
          <TableroColumna
            key={etapa.id}
            etapa={etapa}
            filtro={filtro}
            pendientes={pendientes}
            arrastreDeshabilitado={puedeEditar !== true}
            enMovimiento={enMovimiento}
            alCargar={registrar}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

/**
 * Oportunidades abiertas por etapa. Comparte búsqueda y filtros con el
 * listado; el ListBase solo los guarda, no pide datos (lo hace cada columna).
 */
export const OportunidadTablero = () => (
  <ListBase
    resource="oportunidades"
    sort={{ field: "creado_en", order: "DESC" }}
    filterDefaultValues={FILTROS_INICIALES_OPORTUNIDADES}
    disableSyncWithLocation
    storeKey={CLAVE_FILTROS_OPORTUNIDADES}
    queryOptions={{ enabled: false }}
  >
    <section className="space-y-4 py-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Tablero</h1>
          <p className="text-sm text-muted-foreground">
            Abiertas, por etapa. Arrastrá una tarjeta para cambiarla de etapa;
            para marcarla ganada o perdida, abrila.
          </p>
        </div>
        <AccionesOportunidades />
      </header>
      <BarraFiltros
        buscar={BUSCAR_OPORTUNIDADES}
        filtros={
          <>
            <FiltroResponsable />
            <FiltroSoloEmpresas />
          </>
        }
        ocultos={FILTROS_DEL_LISTADO}
      />
      <Tablero />
    </section>
  </ListBase>
);
