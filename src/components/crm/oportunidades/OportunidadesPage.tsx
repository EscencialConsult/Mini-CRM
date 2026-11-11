import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { OportunidadFormDialog } from "./OportunidadFormDialog";
import { OportunidadList } from "./OportunidadList";
import { OportunidadTablero } from "./tablero/OportunidadTablero";
import { useVistaOportunidades } from "./vistaOportunidades";

/** Tablero por etapa o listado; el alta y el detalle se abren como modal encima. */
export const OportunidadesPage = () => {
  const ruta = useRecordRoute("oportunidades");
  const cerrar = useCloseRecord("oportunidades");
  const [vista] = useVistaOportunidades();

  return (
    <>
      {vista === "listado" ? <OportunidadList /> : <OportunidadTablero />}
      {ruta.mode === "create" && <OportunidadFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <OportunidadFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
