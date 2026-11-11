import type { Cliente } from "../domain/types";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import {
  useCloseRecord,
  useOpenRecord,
  useRecordRoute,
} from "../shared/useRecordRoute";
import { ClienteDialog } from "./ClienteDialog";
import { ClienteInputs } from "./ClienteInputs";
import { ClienteList } from "./ClienteList";

/** Listado de clientes; el alta y la ficha se abren como modal sobre el listado. */
export const ClientesPage = () => {
  const ruta = useRecordRoute("clientes");
  const cerrar = useCloseRecord("clientes");
  const abrir = useOpenRecord("clientes");

  return (
    <>
      <ClienteList />
      {ruta.mode === "create" && (
        <RecordFormDialog<Cliente>
          resource="clientes"
          tituloCrear="Nuevo cliente"
          tituloEditar={(cliente) => cliente.nombre_completo}
          descripcion="Persona o empresa: datos de contacto y estado."
          mensajeGuardado="Cliente creado"
          defaultValues={{ tipo: "persona", estado: "activo", etiquetas: [] }}
          onClose={cerrar}
          // Tras el alta se abre su ficha para cargar oportunidades y actividades
          onSaved={(cliente) => abrir(cliente.id, true)}
        >
          <ClienteInputs />
        </RecordFormDialog>
      )}
      {ruta.mode === "edit" && (
        <ClienteDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
