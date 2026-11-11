import { useCrmIdentity, useEsAdministrador } from "../providers/authProvider";
import type { Oportunidad } from "../domain/types";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { OportunidadInputs } from "./OportunidadInputs";

interface OportunidadFormDialogProps {
  /** Con id edita; sin id crea. */
  id?: string;
  /** Alta desde la ficha de un cliente: el cliente queda fijo. */
  clienteId?: number;
  onClose: () => void;
  onSaved?: (oportunidad: Oportunidad) => void;
}

/** Modal de alta/edición de oportunidad: sirve para la ruta propia y para la ficha del cliente. */
export const OportunidadFormDialog = ({
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
      descripcion="Posible venta: producto o servicio, importe y etapa de negociación."
      mensajeGuardado="Oportunidad guardada"
      defaultValues={{
        cliente_id: clienteId,
        etapa: "prospecto",
        probabilidad: 10,
        resultado: "abierta",
        importe_estimado: 0,
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
