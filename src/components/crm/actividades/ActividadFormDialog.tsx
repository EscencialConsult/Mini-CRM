import type { Actividad, TipoActividad } from "../domain/types";
import { useCrmIdentity } from "../providers/authProvider";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { ActividadInputs } from "./ActividadInputs";
import { ResumenTarea } from "./EstadoTarea";
import { GuardadosTarea } from "./GuardadosTarea";

interface ActividadFormDialogProps {
  /** Con id edita; sin id crea. */
  id?: string;
  /** Tipo con el que arranca el alta (llamada, reunión, nota u otra). */
  tipoInicial?: TipoActividad;
  /** Alta desde la ficha de un cliente / oportunidad: quedan fijos. */
  clienteId?: number;
  oportunidadId?: number;
  onClose: () => void;
  onSaved?: (actividad: Actividad) => void;
}

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
      tituloCrear="Nueva tarea"
      tituloEditar={(actividad) => actividad.titulo}
      descripcion="Registrá una llamada, reunión o nota, o programá una tarea."
      descripcionEditar={(actividad) => <ResumenTarea actividad={actividad} />}
      mensajeGuardado="Tarea guardada"
      defaultValues={{
        tipo: tipoInicial,
        cliente_id: clienteId,
        oportunidad_id: oportunidadId ?? null,
        fecha: new Date().toISOString(),
        // "Guardar" la deja pendiente y "Guardar completada" la cierra (las notas, siempre)
        completada: false,
        asignados: identity ? [identity.id] : [],
      }}
      acciones={(actividad) =>
        // La base solo deja borrar al autor o a un administrador
        actividad.creado_por === identity?.id ||
        identity?.rol === "administrador" ? (
          <DeleteRecordButton
            resource="actividades"
            id={actividad.id}
            previousData={actividad}
            descripcion={`la tarea “${actividad.titulo}”`}
            onDeleted={onClose}
          />
        ) : null
      }
      guardadosExtra={(actividad) => <GuardadosTarea actividad={actividad} />}
      onClose={onClose}
      onSaved={onSaved}
    >
      <ActividadInputs clienteFijo={clienteId !== undefined} />
    </RecordFormDialog>
  );
};
