import { useListContext } from "ra-core";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const SIN_FILTRO = "__todos__";

interface OpcionFiltro {
  id: string;
  name: string;
}

interface FilterSelectProps {
  /** Clave del filtro (`estado`, `asignado_a@eq`…). */
  source: string;
  etiqueta: string;
  opciones: readonly OpcionFiltro[];
  /** Texto de la opción que quita el filtro. */
  todas?: string;
  /** Convierte el id elegido al valor enviado a la API (por defecto, el texto). */
  convertir?: (id: string) => unknown;
}

/** Desplegable de filtro del listado. */
export const FilterSelect = ({
  source,
  etiqueta,
  opciones,
  todas = "Todos",
  convertir,
}: FilterSelectProps) => {
  const { filterValues, setFilters } = useListContext();
  const actual = filterValues[source];
  const valor =
    actual === undefined || actual === null ? SIN_FILTRO : String(actual);

  const alCambiar = (id: string) => {
    const siguiente = { ...filterValues };
    if (id === SIN_FILTRO) delete siguiente[source];
    else siguiente[source] = convertir ? convertir(id) : id;
    setFilters(siguiente, {});
  };

  return (
    <Select value={valor} onValueChange={alCambiar}>
      <SelectTrigger
        aria-label={etiqueta}
        className="w-full min-w-40 sm:w-auto"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SIN_FILTRO}>{`${etiqueta}: ${todas}`}</SelectItem>
        {opciones.map((opcion) => (
          <SelectItem key={opcion.id} value={opcion.id}>
            {opcion.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** Buscador de texto del listado (filtro `q`) con espera de 300 ms al escribir. */
export const ListSearch = ({ placeholder }: { placeholder: string }) => {
  const { filterValues, setFilters } = useListContext();
  const [texto, setTexto] = useState(String(filterValues.q ?? ""));
  const esperado = useDebouncedValue(texto, 300);
  const filtrosRef = useRef(filterValues);
  filtrosRef.current = filterValues;

  useEffect(() => {
    const actual = String(filtrosRef.current.q ?? "");
    if (esperado === actual) return;
    const siguiente = { ...filtrosRef.current };
    if (esperado) siguiente.q = esperado;
    else delete siguiente.q;
    setFilters(siguiente, {});
  }, [esperado, setFilters]);

  return (
    <div className="relative min-w-52 flex-1 sm:max-w-sm">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
};
