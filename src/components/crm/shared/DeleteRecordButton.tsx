import { useDelete, useNotify, type Identifier, type RaRecord } from "ra-core";
import { TriangleAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

/** Borrado definitivo: siempre pide confirmación y avisa que no se puede deshacer. */
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
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setAbierto(true)}
      >
        <Trash2 />
        Eliminar
      </Button>
      <Dialog
        open={abierto}
        onOpenChange={(valor) => !isPending && setAbierto(valor)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert aria-hidden className="size-5" />
              Eliminar definitivamente
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Vas a eliminar <strong>{descripcion}</strong>.
                </p>
                {consecuencia && <p>{consecuencia}</p>}
                <p className="font-medium text-foreground">
                  Es un borrado definitivo: no se puede deshacer ni recuperar.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={isPending}
              onClick={confirmar}
            >
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
