import { MessageCircle, Pencil } from "lucide-react";
import { useGetOne } from "ra-core";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import {
  enlaceWhatsApp,
  formatFechaHora,
  formatMoneda,
  formatNumero,
} from "../domain/format";
import { ORIGENES_PEDIDO, nombreDe } from "../domain/options";
import type { Pedido } from "../domain/types";
import { useEsAdministrador, useModulos } from "../providers/authProvider";
import { EstadoPedidoBadge, Pill } from "../shared/badges";
import { AutoriaInfo } from "../shared/AutoriaInfo";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { RecordDialog } from "../shared/RecordDialog";
import { DialogoCargando } from "../shared/RecordFormDialog";
import { useRefrescarDatos } from "../shared/useRefrescarDatos";
import { CambiarEstadoPedido } from "./CambiarEstadoPedido";
import { fechaEntregaPedido } from "./fechaEntrega";
import { EntregaCelda } from "./PedidoList";
import { PedidoHistorial } from "./PedidoHistorial";

const Seccion = ({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) => (
  <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {titulo}
    </h3>
    {children}
  </section>
);

const Dato = ({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
    <dd className="text-sm break-words">{children}</dd>
  </div>
);

interface PedidoDetalleDialogProps {
  id: string;
  onClose: () => void;
  onEditar: () => void;
}

/**
 * Detalle de un pedido: estado y sus cambios, entrega, líneas e historial. Un
 * pedido entregado o cancelado no se edita (la base lo rechaza): para tocarlo
 * se cambia primero el estado.
 */
export const PedidoDetalleDialog = ({
  id,
  onClose,
  onEditar,
}: PedidoDetalleDialogProps) => {
  const {
    data: pedido,
    isPending,
    error,
    refetch,
  } = useGetOne<Pedido>("pedidos", { id: Number(id) });
  const esAdministrador = useEsAdministrador();
  const { tiene } = useModulos();
  const refrescar = useRefrescarDatos();

  if (isPending) return <DialogoCargando onClose={onClose} />;
  if (error || !pedido) {
    return (
      <RecordDialog title="Pedido" size="md" onClose={onClose}>
        <div
          role="alert"
          className="m-6 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p>No se pudo cargar el pedido. Puede que ya no exista.</p>
          <Button
            size="sm"
            variant="outline"
            className="min-h-10"
            onClick={() => void refetch()}
          >
            Reintentar
          </Button>
        </div>
      </RecordDialog>
    );
  }

  const editable =
    pedido.estado !== "entregado" && pedido.estado !== "cancelado";
  const whatsapp = enlaceWhatsApp(pedido.telefono_whatsapp);
  const lineas = pedido.productos ?? [];

  return (
    <RecordDialog
      title={`Pedido #${pedido.id}`}
      description={`${pedido.cliente_nombre ?? "Cliente"} · ${nombreDe(ORIGENES_PEDIDO, pedido.origen)}`}
      size="lg"
      onClose={onClose}
      summary={
        <div className="flex flex-wrap items-center gap-2">
          <EstadoPedidoBadge estado={pedido.estado} />
          {pedido.prueba && <Pill tono="aviso">Prueba</Pill>}
          <Pill>{fechaEntregaPedido(pedido)}</Pill>
          <span className="ml-auto text-base font-semibold tabular-nums">
            {formatMoneda(pedido.total)}
          </span>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Seccion titulo="Estado">
            <CambiarEstadoPedido pedido={pedido} />
            {pedido.estado === "entregado" && (
              <p className="text-sm text-muted-foreground">
                Entregado el {formatFechaHora(pedido.entregado_en)}.{" "}
                {pedido.prueba ? (
                  "Es un pedido de prueba: no cuenta como venta."
                ) : pedido.venta_id && tiene("oportunidades") ? (
                  <>
                    Ya cuenta como venta:{" "}
                    <Link
                      to={`/oportunidades/${pedido.venta_id}`}
                      className="font-medium text-foreground underline underline-offset-2"
                    >
                      ver la venta
                    </Link>
                    .
                  </>
                ) : (
                  "Ya cuenta como venta."
                )}
              </p>
            )}
            {pedido.estado === "cancelado" && (
              <p className="text-sm text-muted-foreground">
                Un pedido cancelado no suma a Ventas.
              </p>
            )}
          </Seccion>

          <Seccion titulo="Entrega">
            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <Dato etiqueta="Cliente">
                {tiene("clientes") ? (
                  <Link
                    to={`/clientes/${pedido.cliente_id}`}
                    className="font-medium hover:underline"
                  >
                    {pedido.cliente_nombre ?? "Ver cliente"}
                  </Link>
                ) : (
                  (pedido.cliente_nombre ?? "—")
                )}
              </Dato>
              <Dato etiqueta="Entrega">
                <EntregaCelda pedido={pedido} />
              </Dato>
              <Dato etiqueta="Para">{fechaEntregaPedido(pedido)}</Dato>
              {(pedido.tipo_entrega === "envio" ||
                (pedido.tipo_entrega === null && pedido.direccion)) && (
                <Dato etiqueta="Dirección">{pedido.direccion ?? "—"}</Dato>
              )}
              {pedido.telefono_whatsapp && (
                <Dato etiqueta="WhatsApp del comprador">
                  {whatsapp ? (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 font-medium hover:underline"
                    >
                      <MessageCircle aria-hidden className="size-4" />
                      {pedido.telefono_whatsapp}
                    </a>
                  ) : (
                    pedido.telefono_whatsapp
                  )}
                </Dato>
              )}
            </dl>
            {pedido.nota && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm break-words whitespace-pre-line">
                {pedido.nota}
              </p>
            )}
          </Seccion>

          <Seccion titulo="Productos">
            {lineas.length ? (
              <ul className="divide-y rounded-lg border">
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
                <li className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatMoneda(pedido.total)}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin productos.</p>
            )}
          </Seccion>

          <Seccion titulo="Historial">
            <PedidoHistorial pedidoId={pedido.id} />
          </Seccion>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-6 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 text-xs text-muted-foreground sm:flex-1">
            <AutoriaInfo
              creado_en={pedido.creado_en}
              creado_por_nombre={pedido.creado_por_nombre}
              actualizado_en={pedido.actualizado_en}
              actualizado_por_nombre={pedido.actualizado_por_nombre}
              creado_desde={
                pedido.origen === "manual"
                  ? undefined
                  : nombreDe(ORIGENES_PEDIDO, pedido.origen)
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {esAdministrador && pedido.estado !== "entregado" && (
              <DeleteRecordButton
                resource="pedidos"
                id={pedido.id}
                previousData={pedido}
                descripcion={`el pedido #${pedido.id}`}
                onDeleted={() => {
                  void refrescar();
                  onClose();
                }}
              />
            )}
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={onClose}
            >
              Cerrar
            </Button>
            {editable && (
              <Button type="button" className="min-h-10" onClick={onEditar}>
                <Pencil />
                Editar
              </Button>
            )}
          </div>
        </div>
      </div>
    </RecordDialog>
  );
};
