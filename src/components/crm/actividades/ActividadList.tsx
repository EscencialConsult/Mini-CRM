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
import {
  CrmList,
  type ColumnaLista,
  type PestanaLista,
} from "../shared/CrmList";
import type { SeleccionLista } from "../shared/SeleccionLista";
import { FilterSelect, FiltroSoloEmpresas } from "../shared/ListControls";
import { useUsuarios } from "../shared/useUsuarios";
import { AccionesSeleccionTareas } from "./seleccion/AccionesSeleccionTareas";
import { ActividadCompletar } from "./ActividadCompletar";
import { TipoActividadChip } from "./TipoActividad";

/**
 * Pendientes: la que vence (o venció) antes, primero. Completadas: la última
 * completada, primero. Todas: las pendientes así y después las completadas.
 * ra-data-postgrest arma `order=<campo>.<sentido>`, así que un campo
 * compuesto ordena por varias columnas.
 */
const PESTANAS: PestanaLista[] = [
  {
    id: "pendientes",
    etiqueta: "Pendientes",
    filtro: { completada: false },
    orden: { field: "fecha", order: "ASC" },
    vacio: "No hay tareas pendientes.",
  },
  {
    id: "completadas",
    etiqueta: "Completadas",
    filtro: { completada: true },
    orden: { field: "completada_en", order: "DESC" },
    vacio: "Todavía no hay tareas completadas.",
  },
  {
    id: "todas",
    etiqueta: "Todas",
    filtro: {},
    orden: {
      field: "completada.asc,completada_en.desc.nullslast,fecha",
      order: "ASC",
    },
  },
];

const columnas: ColumnaLista<Actividad>[] = [
  {
    id: "titulo",
    encabezado: "Tarea",
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
    encabezado: "Responsables",
    orden: "asignado_nombre",
    etiquetaTarjeta: "Responsables",
    celda: (actividad) => actividad.asignado_nombre ?? "Sin asignar",
  },
  {
    id: "completar",
    encabezado: "",
    alinear: "derecha",
    celda: (actividad) => <ActividadCompletar actividad={actividad} />,
  },
];

const SELECCION: SeleccionLista<Actividad> = {
  etiqueta: (cantidad) =>
    cantidad === 1
      ? "1 tarea seleccionada"
      : `${cantidad} tareas seleccionadas`,
  acciones: (seleccionadas, limpiar) => (
    <AccionesSeleccionTareas seleccionadas={seleccionadas} limpiar={limpiar} />
  ),
};

const NuevaTarea = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button>
        <Plus />
        Nueva tarea
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
      titulo="Tareas"
      sort={PESTANAS[0].orden}
      filterDefaultValues={PESTANAS[0].filtro}
      pestanas={PESTANAS}
      seleccion={SELECCION}
      buscar="Buscar por asunto o cliente"
      filtros={
        <>
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
          <FiltroSoloEmpresas />
        </>
      }
      acciones={<NuevaTarea />}
      columnas={columnas}
      tituloFila={(actividad) => actividad.titulo}
      accionesTarjeta={(actividad) => (
        <ActividadCompletar actividad={actividad} />
      )}
      hrefDe={(actividad) => `/actividades/${actividad.id}`}
      vacio="No hay tareas. Registrá una llamada, reunión, nota u otra tarea."
    />
  );
};
