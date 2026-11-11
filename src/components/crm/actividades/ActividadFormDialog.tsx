import type { Actividad, TipoActividad } from "../domain/types";
import { useCrmIdentity } from "../providers/authProvider";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { ActividadInputs } from "./ActividadInputs";

interface ActividadFormDialogProps {
  /** Con id edita; sin id crea. */
  id?: string;
  /** Tipo con el que arranca el alta (llamada, reunión, nota o tarea). */
  tipoInicial?: TipoActividad;
  /** Alta desde la ficha de un cliente / oportunidad: quedan fijos. */
  clienteId?: number;
  oportunidadId?: number;
  onClose: () => void;
  onSaved?: (actividad: Actividad) => void;
}

/** Una llamada o reunión se registra ya realizada; una tarea nace pendiente. */
const realizadaPorDefecto = (tipo: TipoActividad): boolean =>
  tipo === "llamada" || tipo === "reunion" || tipo === "nota";

export const ActividadFormDialog = ({
  id,
  tipoInicial = "tarea",
  clienteId,
  oportunidadId,
  onClose,
  onSaved,
}: ActividadFormDialogProps) => {
  const { identity } = useCrmIdentity();

  return (
    <RecordFormDialog<Actividad>
      resource="actividades"
      id={id}
      size="lg"
      tituloCrear="Nueva actividad"
      tituloEditar={(actividad) => actividad.titulo}
      descripcion="Llamadas, reuniones, notas y tareas de seguimiento."
      mensajeGuardado="Actividad guardada"
      defaultValues={{
        tipo: tipoInicial,
        cliente_id: clienteId,
        oportunidad_id: oportunidadId ?? null,
        fecha: new Date().toISOString(),
        completada: realizadaPorDefecto(tipoInicial),
        asignado_a: identity?.id ?? null,
      }}
      acciones={(actividad) =>
        // La base solo deja borrar al autor o a un administrador
        actividad.creado_por === identity?.id ||
        identity?.rol === "administrador" ? (
          <DeleteRecordButton
            resource="actividades"
            id={actividad.id}
            previousData={actividad}
            descripcion={`la actividad “${actividad.titulo}”`}
            onDeleted={onClose}
          />
        ) : null
      }
      onClose={onClose}
      onSaved={onSaved}
    >
      <ActividadInputs clienteFijo={clienteId !== undefined} />
    </RecordFormDialog>
  );
};
