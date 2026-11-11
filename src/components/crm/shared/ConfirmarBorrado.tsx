import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmarBorradoProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Qué se borra: "el cliente Juan Pérez", "3 tareas". */
  descripcion: ReactNode;
  /** Qué más se pierde o aclaraciones (oportunidades, cuáles no se borran…). */
  detalle?: ReactNode;
  cargando: boolean;
  onConfirmar: () => void;
}

/** Confirmación de un borrado definitivo: avisa que no se puede deshacer. */
export const ConfirmarBorrado = ({
  abierto,
  onAbiertoChange,
  descripcion,
  detalle,
  cargando,
  onConfirmar,
}: ConfirmarBorradoProps) => (
  <Dialog
    open={abierto}
    onOpenChange={(valor) => !cargando && onAbiertoChange(valor)}
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
            {detalle && <p>{detalle}</p>}
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
          disabled={cargando}
          onClick={() => onAbiertoChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          loading={cargando}
          onClick={onConfirmar}
        >
          Eliminar definitivamente
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
