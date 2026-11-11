import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { UsuarioFormDialog } from "./UsuarioFormDialog";
import { UsuarioList } from "./UsuarioList";

/** Gestión de usuarios (solo administradores): listado con alta y edición en modal. */
export const UsuariosPage = () => {
  const ruta = useRecordRoute("usuarios");
  const cerrar = useCloseRecord("usuarios");

  return (
    <>
      <UsuarioList />
      {ruta.mode === "create" && <UsuarioFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <UsuarioFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
