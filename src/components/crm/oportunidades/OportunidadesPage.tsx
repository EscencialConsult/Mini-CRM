import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { OportunidadFormDialog } from "./OportunidadFormDialog";
import { OportunidadList } from "./OportunidadList";

/** Listado de oportunidades; el alta y el detalle se abren como modal sobre el listado. */
export const OportunidadesPage = () => {
  const ruta = useRecordRoute("oportunidades");
  const cerrar = useCloseRecord("oportunidades");

  return (
    <>
      <OportunidadList />
      {ruta.mode === "create" && <OportunidadFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <OportunidadFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
