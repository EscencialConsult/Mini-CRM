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
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lg">{title}</DialogTitle>
            <DialogDescription className={description ? "mt-1" : "sr-only"}>
              {description ?? "Detalle del registro"}
            </DialogDescription>
          </div>
          {headerActions && (
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </DialogContent>
  </Dialog>
);
