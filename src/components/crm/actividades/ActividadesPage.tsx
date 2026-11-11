import { useSearchParams } from "react-router";

import { TIPOS_ACTIVIDAD } from "../domain/options";
import type { TipoActividad } from "../domain/types";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { ActividadFormDialog } from "./ActividadFormDialog";
import { ActividadList } from "./ActividadList";

const tipoValido = (valor: string | null): TipoActividad | undefined =>
  TIPOS_ACTIVIDAD.find((tipo) => tipo.id === valor)?.id;

/** Tareas en pestañas (pendientes, completadas, todas); el alta y el detalle se abren como modal. */
export const ActividadesPage = () => {
  const ruta = useRecordRoute("actividades");
  const cerrar = useCloseRecord("actividades");
  const [parametros] = useSearchParams();

  return (
    <>
      <ActividadList />
      {ruta.mode === "create" && (
        <ActividadFormDialog
          tipoInicial={tipoValido(parametros.get("tipo"))}
          onClose={cerrar}
        />
      )}
      {ruta.mode === "edit" && (
        <ActividadFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
