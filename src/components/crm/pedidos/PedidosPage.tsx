import { useState } from "react";

import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { PedidoDetalleDialog } from "./PedidoDetalleDialog";
import { PedidoFormDialog } from "./PedidoFormDialog";
import { PedidoList } from "./PedidoList";

/** Detalle de un pedido; "Editar" lo cambia por el formulario sin salir del modal. */
const PedidoAbierto = ({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) => {
  const [editando, setEditando] = useState(false);
  return editando ? (
    <PedidoFormDialog id={id} onClose={() => setEditando(false)} />
  ) : (
    <PedidoDetalleDialog
      id={id}
      onClose={onClose}
      onEditar={() => setEditando(true)}
    />
  );
};

/** Pedidos (módulo Pedidos): listado con el detalle y el alta como modal encima. */
export const PedidosPage = () => {
  const ruta = useRecordRoute("pedidos");
  const cerrar = useCloseRecord("pedidos");

  return (
    <>
      <PedidoList />
      {ruta.mode === "create" && <PedidoFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <PedidoAbierto key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
