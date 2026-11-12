import { FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCanales } from "../canales/useCanales";
import { useProductos } from "../productos/useProductos";
import { useCrmIdentity } from "../providers/authProvider";
import { useUsuarios } from "../shared/useUsuarios";
import {
  PERIODOS_VENTAS,
  type FiltrosVentas,
  type PeriodoVentas,
} from "./filtrosVentas";

const TODOS = "__todos__";

interface SelectFiltroProps {
  etiqueta: string;
  valor: string | undefined;
  opciones: readonly { id: string; name: string }[];
  todos?: string;
  onCambiar: (valor: string | undefined) => void;
}

/** Desplegable de filtro: "Vendedor: Todos" o el elegido. */
const SelectFiltro = ({
  etiqueta,
  valor,
  opciones,
  todos = "Todos",
  onCambiar,
}: SelectFiltroProps) => (
  <Select
    value={valor ?? TODOS}
    onValueChange={(id) => onCambiar(id === TODOS ? undefined : id)}
  >
    <SelectTrigger aria-label={etiqueta} className="w-full min-w-40 sm:w-auto">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={TODOS}>{`${etiqueta}: ${todos}`}</SelectItem>
      {opciones.map((opcion) => (
        <SelectItem key={opcion.id} value={opcion.id}>
          {opcion.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

/** Período, vendedor, canal y producto: valen para el listado y los reportes. */
export const FiltrosVentasBarra = ({
  filtros,
  onCambiar,
}: {
  filtros: FiltrosVentas;
  onCambiar: (filtros: FiltrosVentas) => void;
}) => {
  const { identity } = useCrmIdentity();
  const { opcionesTodas } = useUsuarios();
  const { opcionesFiltro: opcionesCanal } = useCanales();
  const { productos } = useProductos();
  const hayFiltros = !!(filtros.vendedor || filtros.canal || filtros.producto);

  return (
    <div
      role="group"
      aria-label="Filtros de ventas"
      className="flex flex-wrap items-center gap-2"
    >
      <Select
        value={filtros.periodo}
        onValueChange={(periodo) =>
          onCambiar({ ...filtros, periodo: periodo as PeriodoVentas })
        }
      >
        <SelectTrigger
          aria-label="Período de cierre"
          className="w-full sm:w-48"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODOS_VENTAS.map((opcion) => (
            <SelectItem key={opcion.id} value={opcion.id}>
              {opcion.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SelectFiltro
        etiqueta="Vendedor"
        valor={filtros.vendedor}
        opciones={opcionesTodas.map((opcion) =>
          opcion.id === identity?.id
            ? { ...opcion, name: `${opcion.name} (yo)` }
            : opcion,
        )}
        onCambiar={(vendedor) => onCambiar({ ...filtros, vendedor })}
      />
      <SelectFiltro
        etiqueta="Canal"
        valor={filtros.canal ? String(filtros.canal) : undefined}
        opciones={opcionesCanal}
        onCambiar={(canal) =>
          onCambiar({ ...filtros, canal: canal ? Number(canal) : undefined })
        }
      />
      <SelectFiltro
        etiqueta="Producto"
        valor={filtros.producto ? String(filtros.producto) : undefined}
        opciones={productos.map((producto) => ({
          id: String(producto.id),
          name: producto.nombre,
        }))}
        onCambiar={(producto) =>
          onCambiar({
            ...filtros,
            producto: producto ? Number(producto) : undefined,
          })
        }
      />
      {hayFiltros && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onCambiar({ periodo: filtros.periodo })}
        >
          <FilterX />
          Limpiar
        </Button>
      )}
    </div>
  );
};
