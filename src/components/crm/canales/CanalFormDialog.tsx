import { Archive, ArchiveRestore } from "lucide-react";
import { maxLength, required } from "ra-core";

import { TextInput } from "@/components/admin/text-input";

import { plural } from "../domain/format";
import type { Canal } from "../domain/types";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { GuardarCon } from "../shared/RecordForm";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { useRefrescarCanales } from "./useCanales";

const enUso = (canal: Canal) =>
  (canal.clientes ?? 0) + (canal.oportunidades ?? 0);

const usoDe = (canal: Canal) => {
  const partes = [
    canal.clientes && plural(canal.clientes, "cliente", "clientes"),
    canal.oportunidades &&
      plural(canal.oportunidades, "oportunidad", "oportunidades"),
  ].filter(Boolean);
  const uso = partes.length
    ? `Lo tienen ${partes.join(" y ")}.`
    : "Nadie lo usa todavía.";
  if (canal.clave) return `Canal del sistema: no se puede borrar. ${uso}`;
  return canal.activo ? uso : `Inactivo: no se ofrece al elegir. ${uso}`;
};

/** Alta y edición de un canal de venta (solo el administrador). */
export const CanalFormDialog = ({
  id,
  onClose,
}: {
  id?: string;
  onClose: () => void;
}) => {
  const refrescarCanales = useRefrescarCanales();
  const alTerminar = () => {
    void refrescarCanales();
    onClose();
  };

  return (
    <RecordFormDialog<Canal>
      resource="canales"
      id={id}
      tituloCrear="Nuevo canal"
      tituloEditar={(canal) => canal.nombre}
      descripcion="Por dónde llega el cliente: se elige en el cliente y en cada oportunidad."
      descripcionEditar={usoDe}
      mensajeGuardado="Canal guardado"
      defaultValues={{ activo: true }}
      size="md"
      onClose={onClose}
      onSaved={alTerminar}
      acciones={(canal) =>
        canal.clave || enUso(canal) ? null : (
          <DeleteRecordButton
            resource="canales"
            id={canal.id}
            previousData={canal}
            descripcion={`el canal «${canal.nombre}»`}
            onDeleted={alTerminar}
          />
        )
      }
      guardadosExtra={(canal) =>
        canal &&
        (canal.activo ? (
          <GuardarCon
            etiqueta="Desactivar"
            icono={<Archive />}
            valores={{ activo: false }}
          />
        ) : (
          <GuardarCon
            etiqueta="Activar"
            icono={<ArchiveRestore />}
            valores={{ activo: true }}
          />
        ))
      }
    >
      <TextInput
        source="nombre"
        label="Nombre"
        validate={[required(), maxLength(40)]}
      />
    </RecordFormDialog>
  );
};
