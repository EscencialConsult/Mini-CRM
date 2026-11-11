import type { Identifier, RaRecord } from "ra-core";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useSeleccionLista } from "./useSeleccionLista";

/** Selección múltiple de un listado y lo que se puede hacer con ella. */
export interface SeleccionLista<T extends RaRecord> {
  /** "3 tareas seleccionadas". */
  etiqueta: (cantidad: number) => string;
  /** Botones de la barra; reciben los seleccionados en pantalla. */
  acciones: (seleccionados: T[], limpiar: () => void) => ReactNode;
}

/** Casilla de una fila o tarjeta: no abre el registro al tocarla. */
export const CasillaSeleccion = ({
  id,
  etiqueta,
}: {
  id: Identifier;
  etiqueta: string;
}) => {
  const { estaSeleccionado, alternar } = useSeleccionLista();
  return (
    <Checkbox
      checked={estaSeleccionado(id)}
      onCheckedChange={() => alternar(id)}
      onClick={(evento) => evento.stopPropagation()}
      aria-label={etiqueta}
    />
  );
};

/** Casilla del encabezado: todas las filas de la página, o ninguna. */
export const CasillaSeleccionTodas = () => {
  const { todos, algunos, alternarTodos } = useSeleccionLista();
  return (
    <Checkbox
      checked={todos ? true : algunos ? "indeterminate" : false}
      onCheckedChange={alternarTodos}
      aria-label="Seleccionar todas las de esta página"
    />
  );
};

/** Barra fija arriba del listado mientras hay filas seleccionadas. */
export const BarraSeleccion = <T extends RaRecord>({
  seleccion,
}: {
  seleccion: SeleccionLista<T>;
}) => {
  const { seleccionados, limpiar } = useSeleccionLista<T>();
  if (seleccionados.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Acciones sobre la selección"
      className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-md"
    >
      <span className="px-2 text-sm font-medium">
        {seleccion.etiqueta(seleccionados.length)}
      </span>
      {seleccion.acciones(seleccionados, limpiar)}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="ml-auto"
        onClick={limpiar}
      >
        <X />
        Limpiar selección
      </Button>
    </div>
  );
};
