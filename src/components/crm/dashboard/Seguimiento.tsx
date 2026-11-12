import { useGetList, useStore } from "ra-core";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { ActividadCompletar } from "../actividades/ActividadCompletar";
import { TipoActividadChip } from "../actividades/TipoActividad";
import {
  aIsoFecha,
  formatFecha,
  formatFechaHora,
  hoyIso,
} from "../domain/format";
import type { Actividad, Cliente } from "../domain/types";
import { useCrmIdentity, useModulos } from "../providers/authProvider";
import { Pill } from "../shared/badges";

type Alcance = "mias" | "todas";

const FILAS = 8;
const DIAS_PROXIMOS = 7;

const Lista = ({
  isPending,
  error,
  vacio,
  hayDatos,
  children,
}: {
  isPending: boolean;
  error: unknown;
  vacio: string;
  hayDatos: boolean;
  children: ReactNode;
}) => {
  if (isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No se pudo cargar esta sección.
      </p>
    );
  }
  if (!hayDatos)
    return <p className="text-sm text-muted-foreground">{vacio}</p>;
  return <ul className="divide-y">{children}</ul>;
};

const ActividadesPendientes = ({
  responsableId,
}: {
  responsableId?: string;
}) => {
  const { data, isPending, error } = useGetList<Actividad>("actividades", {
    pagination: { page: 1, perPage: FILAS },
    sort: { field: "fecha", order: "ASC" },
    filter: {
      completada: false,
      ...(responsableId ? { asignado_a: responsableId } : {}),
    },
  });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Tareas pendientes</h3>
      <Lista
        isPending={isPending}
        error={error}
        hayDatos={Boolean(data?.length)}
        vacio="No hay tareas pendientes."
      >
        {data?.map((actividad) => (
          <li key={actividad.id} className="flex items-center gap-3 py-2">
            <Link
              to={`/actividades/${actividad.id}`}
              className="min-w-0 flex-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block truncate text-sm font-medium">
                {actividad.titulo}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <TipoActividadChip tipo={actividad.tipo} />
                <span className="truncate">{actividad.cliente_nombre}</span>
                <span>{formatFechaHora(actividad.fecha)}</span>
              </span>
            </Link>
            {actividad.vencida && <Pill tono="peligro">Vencida</Pill>}
            <ActividadCompletar actividad={actividad} />
          </li>
        ))}
      </Lista>
    </div>
  );
};

const ProximosContactos = ({ responsableId }: { responsableId?: string }) => {
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_PROXIMOS);
  const { data, isPending, error } = useGetList<Cliente>("clientes", {
    pagination: { page: 1, perPage: FILAS },
    sort: { field: "proximo_contacto", order: "ASC" },
    filter: {
      estado: "activo",
      "proximo_contacto@lte": aIsoFecha(limite),
      ...(responsableId ? { asignado_a: responsableId } : {}),
    },
  });
  const hoy = hoyIso();

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        Próximos contactos (hasta {DIAS_PROXIMOS} días)
      </h3>
      <Lista
        isPending={isPending}
        error={error}
        hayDatos={Boolean(data?.length)}
        vacio="No hay contactos programados."
      >
        {data?.map((cliente) => {
          const vencido = (cliente.proximo_contacto ?? "") < hoy;
          return (
            <li key={cliente.id}>
              <Link
                to={`/clientes/${cliente.id}`}
                className="flex items-center justify-between gap-3 rounded-sm py-2 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {cliente.nombre_completo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cliente.asignado_nombre ?? "Sin asignar"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm",
                    vencido && "font-medium text-destructive",
                  )}
                >
                  {formatFecha(cliente.proximo_contacto)}
                  {vencido && " · vencido"}
                </span>
              </Link>
            </li>
          );
        })}
      </Lista>
    </div>
  );
};

/** Seguimiento: actividades pendientes y próximos contactos, propios o de todo el equipo. */
export const Seguimiento = () => {
  const { identity } = useCrmIdentity();
  const { tiene } = useModulos();
  const [alcance, setAlcance] = useStore<Alcance>("panel.alcance", "mias");
  const responsableId = alcance === "mias" ? identity?.id : undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Seguimiento</CardTitle>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={alcance}
          onValueChange={(valor) => valor && setAlcance(valor as Alcance)}
          aria-label="Alcance del seguimiento"
        >
          <ToggleGroupItem value="mias">Mías</ToggleGroupItem>
          <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {identity && (
          <>
            {tiene("actividades") && (
              <ActividadesPendientes responsableId={responsableId} />
            )}
            {tiene("clientes") && (
              <ProximosContactos responsableId={responsableId} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
