import { useGetOne } from "ra-core";

import { formatFechaHora } from "../domain/format";
import {
  ACCIONES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  nombreDe,
} from "../domain/options";
import type { RegistroAuditoria } from "../domain/types";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { RecordDialog } from "../shared/RecordDialog";
import { DialogoCargando } from "../shared/RecordFormDialog";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { useUsuarios } from "../shared/useUsuarios";
import { CambiosDetalle } from "./CambiosDetalle";
import { textoAuditoria } from "./textoAuditoria";

const columnas: ColumnaLista<RegistroAuditoria>[] = [
  {
    id: "fecha",
    encabezado: "Fecha",
    orden: "fecha",
    celda: (registro) => formatFechaHora(registro.fecha),
  },
  {
    id: "usuario",
    encabezado: "Usuario",
    orden: "usuario_nombre",
    etiquetaTarjeta: "Usuario",
    celda: (registro) =>
      registro.usuario_nombre ?? registro.origen ?? "Sistema",
  },
  {
    id: "accion",
    encabezado: "Acción",
    etiquetaTarjeta: "Acción",
    celda: (registro) =>
      textoAuditoria(registro.accion, registro.entidad, registro.descripcion),
  },
  {
    id: "entidad",
    encabezado: "Sección",
    orden: "entidad",
    etiquetaTarjeta: "Sección",
    celda: (registro) => nombreDe(ENTIDADES_AUDITORIA, registro.entidad),
  },
];

const DetalleAuditoria = ({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) => {
  const { data: registro, isPending } = useGetOne<RegistroAuditoria>(
    "auditoria",
    {
      id: Number(id),
    },
  );
  if (isPending) return <DialogoCargando onClose={onClose} />;
  if (!registro) return null;

  return (
    <RecordDialog
      title={textoAuditoria(
        registro.accion,
        registro.entidad,
        registro.descripcion,
      )}
      description={`${registro.usuario_nombre ?? registro.origen ?? "Sistema"} · ${formatFechaHora(registro.fecha)}`}
      onClose={onClose}
      size="md"
    >
      <div className="px-6 py-5">
        {registro.cambios ? (
          <CambiosDetalle registro={registro} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin detalle de cambios.
          </p>
        )}
      </div>
    </RecordDialog>
  );
};

/** Registro de auditoría: quién hizo qué y cuándo (solo administradores). */
const AuditoriaPage = () => {
  const ruta = useRecordRoute("auditoria");
  const cerrar = useCloseRecord("auditoria");
  const { opcionesTodas } = useUsuarios();

  return (
    <>
      <CrmList<RegistroAuditoria>
        resource="auditoria"
        titulo="Auditoría"
        sort={{ field: "fecha", order: "DESC" }}
        perPage={50}
        buscar="Buscar por registro o usuario"
        filtros={
          <>
            <FilterSelect
              source="entidad"
              etiqueta="Sección"
              opciones={ENTIDADES_AUDITORIA}
              todas="Todas"
            />
            <FilterSelect
              source="accion"
              etiqueta="Acción"
              opciones={ACCIONES_AUDITORIA}
              todas="Todas"
            />
            <FilterSelect
              source="usuario_id"
              etiqueta="Usuario"
              opciones={opcionesTodas}
            />
          </>
        }
        columnas={columnas}
        tituloFila={(registro) =>
          textoAuditoria(
            registro.accion,
            registro.entidad,
            registro.descripcion,
          )
        }
        hrefDe={(registro) => `/auditoria/${registro.id}/show`}
        vacio="Todavía no hay acciones registradas."
      />
      {ruta.mode === "edit" && (
        <DetalleAuditoria key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};

export default AuditoriaPage;
