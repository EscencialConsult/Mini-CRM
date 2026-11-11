import { ChevronDown, Plus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { formatFechaHora } from "../domain/format";
import { TIPOS_ACTIVIDAD } from "../domain/options";
import type { Actividad } from "../domain/types";
import { useCrmIdentity } from "../providers/authProvider";
import { Pill } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { useUsuarios } from "../shared/useUsuarios";
import { ActividadCheck } from "./ActividadCheck";
import { TipoActividadChip } from "./TipoActividad";

const ESTADOS = [
  { id: "false", name: "Pendientes" },
  { id: "true", name: "Realizadas" },
];

const columnas: ColumnaLista<Actividad>[] = [
  {
    id: "realizada",
    encabezado: "Hecha",
    celda: (actividad) => <ActividadCheck actividad={actividad} />,
  },
  {
    id: "titulo",
    encabezado: "Actividad",
    orden: "titulo",
    enlace: true,
    celda: (actividad) => (
      <span className="block">
        {actividad.titulo}
        {actividad.oportunidad_nombre && (
          <span className="block text-xs font-normal text-muted-foreground">
            {actividad.oportunidad_nombre}
          </span>
        )}
      </span>
    ),
  },
  {
    id: "tipo",
    encabezado: "Tipo",
    orden: "tipo",
    etiquetaTarjeta: "Tipo",
    celda: (actividad) => <TipoActividadChip tipo={actividad.tipo} />,
  },
  {
    id: "cliente",
    encabezado: "Cliente",
    orden: "cliente_nombre",
    etiquetaTarjeta: "Cliente",
    celda: (actividad) => actividad.cliente_nombre,
  },
  {
    id: "fecha",
    encabezado: "Fecha",
    orden: "fecha",
    etiquetaTarjeta: "Fecha",
    celda: (actividad) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {formatFechaHora(actividad.fecha)}
        {actividad.vencida && <Pill tono="peligro">Vencida</Pill>}
      </span>
    ),
  },
  {
    id: "responsable",
    encabezado: "Responsable",
    orden: "asignado_nombre",
    etiquetaTarjeta: "Responsable",
    celda: (actividad) => actividad.asignado_nombre ?? "Sin asignar",
  },
];

const NuevaActividad = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button>
        <Plus />
        Nueva actividad
        <ChevronDown />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {TIPOS_ACTIVIDAD.map((tipo) => (
        <DropdownMenuItem key={tipo.id} asChild>
          <Link to={`/actividades/create?tipo=${tipo.id}`}>{tipo.name}</Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

export const ActividadList = () => {
  const { identity } = useCrmIdentity();
  const { opcionesTodas } = useUsuarios();
  const opcionesResponsable = opcionesTodas.map((opcion) =>
    opcion.id === identity?.id
      ? { ...opcion, name: `${opcion.name} (yo)` }
      : opcion,
  );

  return (
    <CrmList<Actividad>
      resource="actividades"
      titulo="Actividades"
      sort={{ field: "fecha", order: "ASC" }}
      filterDefaultValues={{ completada: false }}
      buscar="Buscar por asunto o cliente"
      filtros={
        <>
          <FilterSelect
            source="completada"
            etiqueta="Estado"
            opciones={ESTADOS}
            todas="Todas"
            convertir={(id) => id === "true"}
          />
          <FilterSelect
            source="tipo"
            etiqueta="Tipo"
            opciones={TIPOS_ACTIVIDAD}
          />
          <FilterSelect
            source="asignado_a"
            etiqueta="Responsable"
            opciones={opcionesResponsable}
          />
        </>
      }
      acciones={<NuevaActividad />}
      columnas={columnas}
      tituloFila={(actividad) => actividad.titulo}
      accionesTarjeta={(actividad) => <ActividadCheck actividad={actividad} />}
      hrefDe={(actividad) => `/actividades/${actividad.id}`}
      vacio="No hay actividades. Registrá una llamada, reunión, nota o tarea."
    />
  );
};
