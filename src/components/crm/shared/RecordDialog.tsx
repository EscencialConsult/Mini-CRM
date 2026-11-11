import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RecordDialogProps {
  title: ReactNode;
  description?: ReactNode;
  /** A la izquierda del título (avatar, ícono). */
  icon?: ReactNode;
  /** Bajo el título: datos clave y accesos rápidos del registro. */
  summary?: ReactNode;
  /** Acciones a la derecha del título (menú, eliminar…). */
  headerActions?: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
}

const ANCHOS = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

/** Modal estándar de los registros: se abre sobre el listado y tiene scroll propio. */
export const RecordDialog = ({
  title,
  description,
  icon,
  summary,
  headerActions,
  onClose,
  size = "lg",
  children,
}: RecordDialogProps) => (
  <Dialog
    open
    onOpenChange={(abierto) => {
      if (!abierto) onClose();
    }}
  >
    <DialogContent
      className={cn(
        "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0",
        ANCHOS[size],
      )}
    >
      <DialogHeader className="border-b px-6 py-4 pr-12">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {icon}
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-lg">{title}</DialogTitle>
              <DialogDescription className={description ? "mt-1" : "sr-only"}>
                {description ?? "Detalle del registro"}
              </DialogDescription>
            </div>
          </div>
          {headerActions && (
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
        {summary && <div className="mt-3">{summary}</div>}
      </DialogHeader>
      {/* Un formulario (RecordForm) ocupa este espacio y scrollea por dentro, con
          el pie fijo; cualquier otro contenido scrollea acá */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </DialogContent>
  </Dialog>
);
