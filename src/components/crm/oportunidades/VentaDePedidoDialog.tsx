import { Lock } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha, formatMoneda, formatNumero } from "../domain/format";
import type { Oportunidad } from "../domain/types";
import { useModulos } from "../providers/authProvider";
import { ResultadoBadge } from "../shared/badges";
import { RecordDialog } from "../shared/RecordDialog";

/**
 * Una venta que viene de un pedido se abre de solo lectura: la base no deja
 * editarla ni borrarla (se crea al entregar el pedido y se elimina al
 * revertir la entrega). Se cambia desde Pedidos.
 */
export const VentaDePedidoDialog = ({
  oportunidad,
  onClose,
}: {
  oportunidad: Oportunidad;
  onClose: () => void;
}) => {
  const { tiene } = useModulos();
  const lineas = oportunidad.productos ?? [];

  return (
    <RecordDialog
      title={oportunidad.producto_servicio}
      description={`Venta del pedido #${oportunidad.pedido_id}: se cambia desde Pedidos, no desde acá.`}
      size="lg"
      onClose={onClose}
      summary={
        <div className="flex flex-wrap items-center gap-2">
          <ResultadoBadge resultado={oportunidad.resultado} />
          <span className="ml-auto text-base font-semibold tabular-nums">
            {formatMoneda(oportunidad.importe_estimado)}
          </span>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Lock
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span>
              Solo lectura. Para corregirla, volvé el pedido #
              {oportunidad.pedido_id} a otro estado desde Pedidos (se pide un
              motivo y la venta se elimina).
            </span>
          </p>

          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Cliente</dt>
              <dd className="text-sm break-words">
                {oportunidad.cliente_nombre ?? "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Cierre</dt>
              <dd className="text-sm">
                {formatFecha(oportunidad.fecha_cierre)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Canal</dt>
              <dd className="text-sm break-words">
                {oportunidad.canal_nombre ?? "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Responsables</dt>
              <dd className="text-sm break-words">
                {oportunidad.asignado_nombre ?? "Sin asignar"}
              </dd>
            </div>
          </dl>

          {lineas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin productos.</p>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Productos">
              {lineas.map((linea) => (
                <li
                  key={linea.producto_id}
                  className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium">
                      {linea.nombre ?? "Producto"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatNumero(linea.cantidad)} ×{" "}
                      {formatMoneda(linea.precio_unitario)}
                      {linea.descuento
                        ? ` (-${formatNumero(linea.descuento)} %)`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoneda(linea.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            onClick={onClose}
          >
            Cerrar
          </Button>
          {tiene("pedidos") && oportunidad.pedido_id && (
            <Button asChild className="min-h-10">
              <Link to={`/pedidos/${oportunidad.pedido_id}`}>
                Ver el pedido #{oportunidad.pedido_id}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </RecordDialog>
  );
};
