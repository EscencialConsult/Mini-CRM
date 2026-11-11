import { Columns3, List, Plus, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { useCrmIdentity } from "../providers/authProvider";
import { FilterSelect } from "../shared/ListControls";
import { useUsuarios } from "../shared/useUsuarios";
import {
  useVistaOportunidades,
  type VistaOportunidades,
} from "./vistaOportunidades";

const VISTAS: {
  id: VistaOportunidades;
  etiqueta: string;
  Icono: LucideIcon;
}[] = [
  { id: "tablero", etiqueta: "Tablero", Icono: Columns3 },
  { id: "listado", etiqueta: "Listado", Icono: List },
];

const SelectorVista = () => {
  const [vista, setVista] = useVistaOportunidades();
  return (
    <div
      role="group"
      aria-label="Vista"
      className="flex rounded-md border bg-background p-0.5"
    >
      {VISTAS.map(({ id, etiqueta, Icono }) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant={vista === id ? "secondary" : "ghost"}
          aria-pressed={vista === id}
          onClick={() => setVista(id)}
        >
          <Icono />
          {etiqueta}
        </Button>
      ))}
    </div>
  );
};

/** Junto al título de las dos vistas: cambiar de vista y dar de alta. */
export const AccionesOportunidades = () => (
  <div className="flex flex-wrap items-center gap-2">
    <SelectorVista />
    <Button asChild>
      <Link to="/oportunidades/create">
        <Plus />
        Nueva oportunidad
      </Link>
    </Button>
  </div>
);

/** Filtro por responsable, con el usuario actual marcado como "(yo)". */
export const FiltroResponsable = () => {
  const { identity } = useCrmIdentity();
  const { opcionesTodas } = useUsuarios();
  return (
    <FilterSelect
      source="asignado_a"
      etiqueta="Responsable"
      opciones={opcionesTodas.map((opcion) =>
        opcion.id === identity?.id
          ? { ...opcion, name: `${opcion.name} (yo)` }
          : opcion,
      )}
    />
  );
};
