import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Ban } from "lucide-react";
import { useNotify } from "ra-core";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  ESTADOS_PEDIDO,
  estadosAlcanzables,
  nombreDe,
  proximoEstado,
} from "../domain/options";
import type { EstadoPedido, Pedido } from "../domain/types";
import { useCrmDataProvider } from "../providers/dataProvider";
import { useRefrescarDatos } from "../shared/useRefrescarDatos";

const MAX_MOTIVO = 500;

interface MotivoEstadoDialogProps {
  pedido: Pedido;
  destino: EstadoPedido;
  cargando: boolean;
  onConfirmar: (motivo: string) => void;
  onCerrar: () => void;
}

/** Salir de Entregado borra la venta: la base exige un motivo y queda en el historial. */
const MotivoEstadoDialog = ({
  pedido,
  destino,
  cargando,
  onConfirmar,
  onCerrar,
}: MotivoEstadoDialogProps) => {
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const vacio = !motivo.trim();

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setTocado(true);
    if (!vacio) onConfirmar(motivo.trim());
  };

  return (
    <Dialog
      open
      onOpenChange={(abierto) => !abierto && !cargando && onCerrar()}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={enviar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              Volver el pedido #{pedido.id} a «
              {nombreDe(ESTADOS_PEDIDO, destino)}»
            </DialogTitle>
            <DialogDescription>
              El pedido ya estaba entregado: la venta que se generó se elimina y
              el cambio queda registrado en el historial y en la auditoría.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-estado-pedido">Motivo</Label>
            <Textarea
              id="motivo-estado-pedido"
              value={motivo}
              rows={3}
              maxLength={MAX_MOTIVO}
              autoFocus
              aria-invalid={tocado && vacio ? true : undefined}
              aria-describedby={
                tocado && vacio ? "motivo-estado-error" : undefined
              }
              placeholder="Por ejemplo: el comprador no recibió el pedido"
              onChange={(evento) => setMotivo(evento.target.value)}
              onBlur={() => setTocado(true)}
            />
            {tocado && vacio && (
              <p id="motivo-estado-error" className="text-xs text-destructive">
                Escribí el motivo para continuar.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              disabled={cargando}
              onClick={onCerrar}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-10" loading={cargando}>
              Cambiar estado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Botones de cambio de estado de un pedido: el paso que sigue, "Cancelar
 * pedido" y un desplegable con el resto (volver atrás incluido). El cambio lo
 * hace `pedido_cambiar_estado`, que también arma o elimina la venta.
 */
export const CambiarEstadoPedido = ({ pedido }: { pedido: Pedido }) => {
  const notify = useNotify();
  const dataProvider = useCrmDataProvider();
  const refrescar = useRefrescarDatos();
  const [pendiente, setPendiente] = useState<EstadoPedido | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: ({
      estado,
      motivo,
    }: {
      estado: EstadoPedido;
      motivo?: string;
    }) => dataProvider.cambiarEstadoPedido(pedido.id, estado, motivo),
    onSuccess: (_actualizado, { estado }) => {
      notify(`Pedido #${pedido.id}: ${nombreDe(ESTADOS_PEDIDO, estado)}`, {
        type: "success",
      });
      setPendiente(null);
      void refrescar();
    },
    onError: () =>
      notify(
        "No se pudo cambiar el estado del pedido. Revisá que siga existiendo y probá de nuevo.",
        { type: "error" },
      ),
  });

  const siguiente = proximoEstado(pedido.estado, pedido.tipo_entrega);
  const alcanzables = estadosAlcanzables(pedido.estado, pedido.tipo_entrega);
  const otros = alcanzables.filter(
    (estado) => estado !== siguiente && estado !== "cancelado",
  );
  const puedeCancelar = alcanzables.includes("cancelado");
  // Salir de Entregado pide motivo: se pregunta antes
  const pedirMotivo = pedido.estado === "entregado";

  const cambiar = (estado: EstadoPedido) => {
    if (pedirMotivo) setPendiente(estado);
    else mutate({ estado });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {siguiente && (
        <Button
          type="button"
          className="min-h-10"
          loading={isPending && !pendiente}
          disabled={isPending}
          onClick={() => cambiar(siguiente)}
        >
          <ArrowRight />
          {siguiente === "entregado"
            ? "Marcar como entregado"
            : `Pasar a ${nombreDe(ESTADOS_PEDIDO, siguiente)}`}
        </Button>
      )}
      {otros.length > 0 && (
        <Select
          value=""
          disabled={isPending}
          onValueChange={(valor) => {
            const estado = otros.find((otro) => otro === valor);
            if (estado) cambiar(estado);
          }}
        >
          <SelectTrigger
            aria-label="Pasar el pedido a otro estado"
            className="min-h-10 w-full sm:w-52"
          >
            <SelectValue placeholder="Pasar a otro estado…" />
          </SelectTrigger>
          <SelectContent>
            {otros.map((estado) => (
              <SelectItem key={estado} value={estado}>
                {nombreDe(ESTADOS_PEDIDO, estado)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {puedeCancelar && (
        <Button
          type="button"
          variant="outline"
          className="min-h-10 text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => cambiar("cancelado")}
        >
          <Ban />
          Cancelar pedido
        </Button>
      )}
      {pendiente && (
        <MotivoEstadoDialog
          pedido={pedido}
          destino={pendiente}
          cargando={isPending}
          onConfirmar={(motivo) => mutate({ estado: pendiente, motivo })}
          onCerrar={() => setPendiente(null)}
        />
      )}
    </div>
  );
};
