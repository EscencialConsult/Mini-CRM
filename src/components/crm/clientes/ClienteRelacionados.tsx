import { useGetList, type SortPayload } from "ra-core";
import { ChevronDown, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { ActividadCheck } from "../actividades/ActividadCheck";
import { ActividadFormDialog } from "../actividades/ActividadFormDialog";
import { TipoActividadChip } from "../actividades/TipoActividad";
import { CambiosDetalle } from "../auditoria/CambiosDetalle";
import { textoAuditoria } from "../auditoria/textoAuditoria";
import { formatFechaHora, formatMoneda } from "../domain/format";
import { TIPOS_ACTIVIDAD } from "../domain/options";
import type {
  Actividad,
  Oportunidad,
  RegistroAuditoria,
  TipoActividad,
} from "../domain/types";
import { OportunidadFormDialog } from "../oportunidades/OportunidadFormDialog";
import { EtapaBadge, Pill, ResultadoBadge } from "../shared/badges";

const POR_PAGINA = 50;

interface Seccion<T> {
  data: T[] | undefined;
  isPending: boolean;
  error: unknown;
  total: number | undefined;
}

const useRelacionados = <T extends { id: number }>(
  resource: string,
  clienteId: number,
  sort: SortPayload,
): Seccion<T> => {
  const { data, isPending, error, total } = useGetList<T>(resource, {
    pagination: { page: 1, perPage: POR_PAGINA },
    sort,
    filter: { cliente_id: clienteId },
  });
  return { data, isPending, error, total };
};

/** Estados de carga, error y vacío de una sección de la ficha, sin tumbar las demás. */
const Estado = <T,>({
  seccion,
  vacio,
  children,
}: {
  seccion: Seccion<T>;
  vacio: string;
  children: (datos: T[]) => ReactNode;
}) => {
  if (seccion.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (seccion.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No se pudo cargar esta sección.
      </p>
    );
  }
  if (!seccion.data?.length) {
    return <p className="text-sm text-muted-foreground">{vacio}</p>;
  }
  return <>{children(seccion.data)}</>;
};

const Encabezado = ({
  titulo,
  accion,
}: {
  titulo: string;
  accion?: ReactNode;
}) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h3 className="text-sm font-medium">{titulo}</h3>
    {accion}
  </div>
);

export const ClienteOportunidades = ({ clienteId }: { clienteId: number }) => {
  const seccion = useRelacionados<Oportunidad>("oportunidades", clienteId, {
    field: "creado_en",
    order: "DESC",
  });
  const [formulario, setFormulario] = useState<{ id?: string } | null>(null);

  return (
    <div className="px-6 py-5">
      <Encabezado
        titulo="Oportunidades del cliente"
        accion={
          <Button size="sm" onClick={() => setFormulario({})}>
            <Plus />
            Nueva oportunidad
          </Button>
        }
      />
      <Estado
        seccion={seccion}
        vacio="Este cliente todavía no tiene oportunidades."
      >
        {(oportunidades) => (
          <ul className="divide-y rounded-lg border">
            {oportunidades.map((oportunidad) => (
              <li key={oportunidad.id}>
                <button
                  type="button"
                  onClick={() => setFormulario({ id: String(oportunidad.id) })}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {oportunidad.producto_servicio}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMoneda(oportunidad.importe_estimado)} ·{" "}
                      {oportunidad.probabilidad} %
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <EtapaBadge etapa={oportunidad.etapa} />
                    <ResultadoBadge resultado={oportunidad.resultado} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Estado>
      {formulario && (
        <OportunidadFormDialog
          id={formulario.id}
          clienteId={clienteId}
          onClose={() => setFormulario(null)}
        />
      )}
    </div>
  );
};

export const ClienteActividades = ({ clienteId }: { clienteId: number }) => {
  const seccion = useRelacionados<Actividad>("actividades", clienteId, {
    field: "fecha",
    order: "DESC",
  });
  const [formulario, setFormulario] = useState<{
    id?: string;
    tipo?: TipoActividad;
  } | null>(null);

  return (
    <div className="px-6 py-5">
      <Encabezado
        titulo="Actividades y seguimiento"
        accion={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus />
                Registrar
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TIPOS_ACTIVIDAD.map((tipo) => (
                <DropdownMenuItem
                  key={tipo.id}
                  onSelect={() => setFormulario({ tipo: tipo.id })}
                >
                  {tipo.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Estado
        seccion={seccion}
        vacio="Todavía no hay actividades con este cliente."
      >
        {(actividades) => (
          <ul className="divide-y rounded-lg border">
            {actividades.map((actividad) => (
              <li
                key={actividad.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <ActividadCheck actividad={actividad} />
                <button
                  type="button"
                  onClick={() => setFormulario({ id: String(actividad.id) })}
                  className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate font-medium">
                    {actividad.titulo}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <TipoActividadChip tipo={actividad.tipo} />
                    <span>{formatFechaHora(actividad.fecha)}</span>
                    {actividad.asignado_nombre && (
                      <span>{actividad.asignado_nombre}</span>
                    )}
                  </span>
                </button>
                {actividad.vencida && <Pill tono="peligro">Vencida</Pill>}
              </li>
            ))}
          </ul>
        )}
      </Estado>
      {formulario && (
        <ActividadFormDialog
          id={formulario.id}
          tipoInicial={formulario.tipo}
          clienteId={clienteId}
          onClose={() => setFormulario(null)}
        />
      )}
    </div>
  );
};

/** Quién hizo qué sobre este cliente y sus oportunidades y actividades (solo administradores). */
export const ClienteHistorial = ({ clienteId }: { clienteId: number }) => {
  const seccion = useRelacionados<RegistroAuditoria>("auditoria", clienteId, {
    field: "fecha",
    order: "DESC",
  });

  return (
    <div className="px-6 py-5">
      <Encabezado titulo="Historial de cambios" />
      <Estado seccion={seccion} vacio="Todavía no hay cambios registrados.">
        {(registros) => (
          <ol className="space-y-3">
            {registros.map((registro) => (
              <li key={registro.id} className="rounded-lg border px-4 py-3">
                <p className="text-sm">
                  <strong>
                    {registro.usuario_nombre ?? registro.origen ?? "Sistema"}
                  </strong>{" "}
                  {textoAuditoria(
                    registro.accion,
                    registro.entidad,
                    registro.descripcion,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFechaHora(registro.fecha)}
                </p>
                {registro.accion === "editar" && (
                  <div className="mt-2">
                    <CambiosDetalle registro={registro} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Estado>
    </div>
  );
};
