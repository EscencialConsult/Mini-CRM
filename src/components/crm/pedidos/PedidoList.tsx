import { Clock, Plus, Store, Truck } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatMoneda } from "../domain/format";
import {
  ENTREGAS_PEDIDO_CON_COORDINAR,
  ESTADOS_PEDIDO,
  ORIGENES_PEDIDO,
  nombreDe,
  nombreEntrega,
} from "../domain/options";
import type { Pedido } from "../domain/types";
import { EstadoPedidoBadge, Pill } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { fechaEntregaPedido } from "./fechaEntrega";

export const EntregaCelda = ({ pedido }: { pedido: Pedido }) => {
  const Icono =
    pedido.tipo_entrega === "envio"
      ? Truck
      : pedido.tipo_entrega === "retiro"
        ? Store
        : Clock;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icono aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {nombreEntrega(pedido.tipo_entrega)}
    </span>
  );
};

const columnas: ColumnaLista<Pedido>[] = [
  {
    id: "numero",
    encabezado: "Pedido",
    orden: "id",
    celda: (pedido) => (
      <span className="block">
        #{pedido.id}
        {pedido.prueba && (
          <Pill tono="aviso" className="ml-2 align-middle">
            Prueba
          </Pill>
        )}
        <span
          title={pedido.titulo}
          className="block max-w-56 truncate text-xs font-normal text-muted-foreground"
        >
          {pedido.titulo}
        </span>
      </span>
    ),
  },
  {
    id: "cliente",
    encabezado: "Cliente",
    orden: "cliente_nombre",
    etiquetaTarjeta: "Cliente",
    celda: (pedido) => pedido.cliente_nombre ?? "—",
  },
  {
    id: "origen",
    encabezado: "Origen",
    orden: "origen",
    etiquetaTarjeta: "Origen",
    celda: (pedido) => nombreDe(ORIGENES_PEDIDO, pedido.origen),
  },
  {
    id: "entrega",
    encabezado: "Entrega",
    orden: "tipo_entrega",
    etiquetaTarjeta: "Entrega",
    celda: (pedido) => <EntregaCelda pedido={pedido} />,
  },
  {
    id: "fecha",
    encabezado: "Fecha de entrega",
    orden: "entrega_en",
    etiquetaTarjeta: "Para",
    celda: fechaEntregaPedido,
  },
  {
    id: "total",
    encabezado: "Total",
    orden: "total",
    alinear: "derecha",
    etiquetaTarjeta: "Total",
    celda: (pedido) => formatMoneda(pedido.total),
  },
  {
    id: "estado",
    encabezado: "Estado",
    orden: "estado",
    etiquetaTarjeta: "Estado",
    celda: (pedido) => <EstadoPedidoBadge estado={pedido.estado} />,
  },
];

/** Listado de pedidos: tabla en escritorio, tarjetas en móvil; filtros por estado, entrega y origen. */
export const PedidoList = () => (
  <CrmList<Pedido>
    resource="pedidos"
    titulo="Pedidos"
    sort={{ field: "creado_en", order: "DESC" }}
    buscar="Buscar por número, cliente o producto"
    filtros={
      <>
        <FilterSelect
          source="estado"
          etiqueta="Estado"
          opciones={ESTADOS_PEDIDO}
        />
        <FilterSelect
          source="tipo_entrega"
          etiqueta="Entrega"
          opciones={ENTREGAS_PEDIDO_CON_COORDINAR}
          todas="Todas"
        />
        <FilterSelect
          source="origen"
          etiqueta="Origen"
          opciones={ORIGENES_PEDIDO}
        />
      </>
    }
    acciones={
      <Button asChild>
        <Link to="/pedidos/create">
          <Plus />
          Nuevo pedido
        </Link>
      </Button>
    }
    columnas={columnas}
    tituloFila={(pedido) =>
      `Pedido #${pedido.id} · ${pedido.cliente_nombre ?? ""}`
    }
    hrefDe={(pedido) => `/pedidos/${pedido.id}`}
    vacio="Todavía no hay pedidos. Llegan solos desde WhatsApp y las landings con carrito, o cargá uno con “Nuevo pedido”."
  />
);
