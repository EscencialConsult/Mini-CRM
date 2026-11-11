import { maxLength, required } from "ra-core";

import { TextInput } from "@/components/admin/text-input";

import { COLORES_ETIQUETA } from "../domain/options";
import { plural } from "../domain/format";
import type { Etiqueta } from "../domain/types";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { ColorEtiquetaInput } from "./ColorEtiquetaInput";
import { useEtiquetas, useRefrescarEtiquetas } from "./useEtiquetas";

const usoDe = (etiqueta: Etiqueta) =>
  etiqueta.clientes
    ? `La tienen ${plural(etiqueta.clientes, "cliente", "clientes")}.`
    : "Ningún cliente la tiene todavía.";

/** Alta y edición de una etiqueta (solo administradores): nombre y color. */
export const EtiquetaFormDialog = ({
  id,
  onClose,
}: {
  id?: string;
  onClose: () => void;
}) => {
  const { etiquetas } = useEtiquetas();
  const refrescarEtiquetas = useRefrescarEtiquetas();
  // El mismo color que elegiría la base: el siguiente de la paleta
  const colorSiguiente =
    COLORES_ETIQUETA[etiquetas.length % COLORES_ETIQUETA.length].id;
  const alTerminar = () => {
    void refrescarEtiquetas();
    onClose();
  };

  return (
    <RecordFormDialog<Etiqueta>
      resource="etiquetas"
      id={id}
      tituloCrear="Nueva etiqueta"
      tituloEditar={(etiqueta) => etiqueta.nombre}
      descripcion="Nombre y color con el que se ve en los clientes."
      descripcionEditar={usoDe}
      mensajeGuardado="Etiqueta guardada"
      defaultValues={{ color: colorSiguiente }}
      size="md"
      onClose={onClose}
      onSaved={alTerminar}
      acciones={(etiqueta) => (
        <DeleteRecordButton
          resource="etiquetas"
          id={etiqueta.id}
          previousData={etiqueta}
          descripcion={`la etiqueta «${etiqueta.nombre}»`}
          consecuencia={
            etiqueta.clientes
              ? `Se quita de ${plural(etiqueta.clientes, "cliente", "clientes")}; los clientes no se borran.`
              : undefined
          }
          onDeleted={alTerminar}
        />
      )}
    >
      <TextInput
        source="nombre"
        label="Nombre"
        validate={[required(), maxLength(40)]}
      />
      <ColorEtiquetaInput />
    </RecordFormDialog>
  );
};
