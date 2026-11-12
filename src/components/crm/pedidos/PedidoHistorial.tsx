import { useGetList } from "ra-core";
import { ArrowRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { formatFechaHora } from "../domain/format";
import type { PedidoHistorial as RegistroHistorial } from "../domain/types";
import { EstadoPedidoBadge } from "../shared/badges";
import { useUsuarios } from "../shared/useUsuarios";

/** Cada cambio de estado del pedido: de cuál a cuál, quién, cuándo y por qué. */
export const PedidoHistorial = ({ pedidoId }: { pedidoId: number }) => {
  const { usuarios } = useUsuarios();
  const { data, isPending, error, refetch } = useGetList<RegistroHistorial>(
    "pedido_historial",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "fecha", order: "DESC" },
      filter: { pedido_id: pedidoId },
    },
  );

  const quien = (registro: RegistroHistorial): string => {
    const usuario = usuarios.find((otro) => otro.id === registro.usuario_id);
    if (usuario) return `${usuario.nombre} ${usuario.apellido}`.trim();
    return (
      registro.origen ?? (registro.usuario_id ? "Usuario eliminado" : "Sistema")
    );
  };

  if (isPending) {
    return (
      <div
        className="space-y-2"
        aria-busy="true"
        aria-label="Cargando historial"
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No se pudo cargar el historial.{" "}
        <button
          type="button"
          className="inline-flex min-h-10 items-center px-2 underline underline-offset-2"
          onClick={() => void refetch()}
        >
          Reintentar
        </button>
      </p>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay cambios de estado.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {data.map((registro) => (
        <li key={registro.id} className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            {registro.estado_anterior && (
              <>
                <EstadoPedidoBadge estado={registro.estado_anterior} />
                <ArrowRight
                  aria-label="pasó a"
                  role="img"
                  className="size-3.5 text-muted-foreground"
                />
              </>
            )}
            <EstadoPedidoBadge estado={registro.estado} />
          </div>
          <p className="text-xs text-muted-foreground">
            {quien(registro)} · {formatFechaHora(registro.fecha)}
          </p>
          {registro.motivo && (
            <p className="break-words rounded-md bg-muted/50 px-3 py-2 text-sm">
              Motivo: {registro.motivo}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
};
