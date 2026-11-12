import { formatFechaHora } from "../domain/format";
import type { Pedido } from "../domain/types";

/** "Para ahora" cuando no tiene fecha; si no, día y hora de la entrega. */
export const fechaEntregaPedido = (pedido: Pedido): string =>
  pedido.entrega_en ? formatFechaHora(pedido.entrega_en) : "Para ahora";
