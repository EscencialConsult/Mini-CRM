import { useDelete, useNotify, type Identifier, type RaRecord } from "ra-core";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ConfirmarBorrado } from "./ConfirmarBorrado";

interface DeleteRecordButtonProps {
  resource: string;
  id: Identifier;
  previousData: RaRecord;
  /** Nombre visible del registro: "el cliente Juan Pérez". */
  descripcion: string;
  /** Qué más se pierde al borrar (oportunidades, actividades…). */
  consecuencia?: string;
  onDeleted: () => void;
}

/**
 * Borrado definitivo: siempre pide confirmación y avisa que no se puede
 * deshacer. Va en el pie del modal, junto a Cancelar.
 */
export const DeleteRecordButton = ({
  resource,
  id,
  previousData,
  descripcion,
  consecuencia,
  onDeleted,
}: DeleteRecordButtonProps) => {
  const [abierto, setAbierto] = useState(false);
  const [eliminar, { isPending }] = useDelete();
  const notify = useNotify();

  const confirmar = async () => {
    try {
      await eliminar(
        resource,
        { id, previousData },
        { returnPromise: true, mutationMode: "pessimistic" },
      );
      notify("Registro eliminado definitivamente", { type: "success" });
      setAbierto(false);
      onDeleted();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el registro",
        { type: "error" },
      );
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setAbierto(true)}
      >
        <Trash2 />
        {/* En móvil solo el ícono, para que los botones del pie entren en una fila */}
        <span className="max-sm:sr-only">Eliminar</span>
      </Button>
      <ConfirmarBorrado
        abierto={abierto}
        onAbiertoChange={setAbierto}
        descripcion={descripcion}
        detalle={consecuencia}
        cargando={isPending}
        onConfirmar={confirmar}
      />
    </>
  );
};
