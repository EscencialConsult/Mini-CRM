import { useGetOne } from "ra-core";

import { useCrmIdentity, useEsAdministrador } from "../providers/authProvider";
import type { Oportunidad } from "../domain/types";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { DialogoCargando, RecordFormDialog } from "../shared/RecordFormDialog";
import { LINEA_VACIA } from "./lineasProductos";
import { OportunidadInputs } from "./OportunidadInputs";
import { VentaDePedidoDialog } from "./VentaDePedidoDialog";

interface OportunidadFormDialogProps {
  /** Con id edita; sin id crea. */
  id?: string;
  /** Alta desde la ficha de un cliente: el cliente queda fijo. */
  clienteId?: number;
  onClose: () => void;
  onSaved?: (oportunidad: Oportunidad) => void;
}

/**
 * Modal de alta/edición de oportunidad: sirve para la ruta propia y para la
 * ficha del cliente. Una venta que viene de un pedido se abre de solo lectura.
 */
export const OportunidadFormDialog = (props: OportunidadFormDialogProps) =>
  props.id === undefined ? (
    <Formulario {...props} />
  ) : (
    <ConGuardaDePedido {...props} id={props.id} />
  );

const ConGuardaDePedido = (
  props: OportunidadFormDialogProps & { id: string },
) => {
  const { data: oportunidad, isPending } = useGetOne<Oportunidad>(
    "oportunidades",
    { id: Number(props.id) },
  );
  if (isPending) return <DialogoCargando onClose={props.onClose} />;
  if (oportunidad?.pedido_id) {
    return (
      <VentaDePedidoDialog oportunidad={oportunidad} onClose={props.onClose} />
    );
  }
  return <Formulario {...props} />;
};

const Formulario = ({
  id,
  clienteId,
  onClose,
  onSaved,
}: OportunidadFormDialogProps) => {
  const { identity } = useCrmIdentity();
  const esAdministrador = useEsAdministrador();

  return (
    <RecordFormDialog<Oportunidad>
      resource="oportunidades"
      id={id}
      size="lg"
      tituloCrear="Nueva oportunidad"
      tituloEditar={(oportunidad) => oportunidad.producto_servicio}
      descripcion="Posible venta: productos, etapa de negociación y responsables. El importe es la suma de los productos."
      mensajeGuardado="Oportunidad guardada"
      defaultValues={{
        cliente_id: clienteId,
        etapa: "prospecto",
        probabilidad: 10,
        resultado: "abierta",
        productos: [{ ...LINEA_VACIA }],
        asignados: identity ? [identity.id] : [],
      }}
      acciones={(oportunidad) =>
        esAdministrador ? (
          <DeleteRecordButton
            resource="oportunidades"
            id={oportunidad.id}
            previousData={oportunidad}
            descripcion={`la oportunidad “${oportunidad.producto_servicio}”`}
            consecuencia="Sus tareas quedan en el cliente, sin oportunidad asociada."
            onDeleted={onClose}
          />
        ) : null
      }
      onClose={onClose}
      onSaved={onSaved}
    >
      <OportunidadInputs clienteFijo={clienteId !== undefined} />
    </RecordFormDialog>
  );
};
