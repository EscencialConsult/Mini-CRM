import { useEffect, useRef, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  md: "sm:w-[28rem]",
  lg: "sm:w-[40rem]",
  xl: "sm:w-[56rem]",
} as const;

/**
 * Los padres cierran el panel desmontándolo, así que Radix no alcanza a animar
 * la salida. Al desmontarse (el nodo ya salió del DOM) se deja una copia del
 * panel y de su velo que se desliza hacia afuera y se descarta sola. En el
 * doble montaje de StrictMode el nodo sigue conectado: ahí no se hace nada.
 */
const DURACION_SALIDA_MS = 150;

const dejarSalirCopia = (panel: HTMLElement) => {
  if (panel.isConnected) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const velo = document.createElement("div");
  velo.className =
    "fixed inset-0 z-50 bg-black/30 animate-out fade-out-0 duration-150 fill-mode-forwards";
  const copia = panel.cloneNode(true) as HTMLElement;
  copia.dataset.state = "closed";
  copia.classList.add("fill-mode-forwards");
  copia.setAttribute("aria-hidden", "true");
  copia.removeAttribute("id");
  copia.style.pointerEvents = "none";
  velo.style.pointerEvents = "none";
  document.body.append(velo, copia);
  window.setTimeout(() => {
    velo.remove();
    copia.remove();
  }, DURACION_SALIDA_MS + 50);
};

/**
 * Panel lateral estándar de los registros: se desliza desde la derecha, de alto
 * completo, y deja el listado visible al costado. Tiene scroll propio.
 */
export const RecordDialog = ({
  title,
  description,
  icon,
  summary,
  headerActions,
  onClose,
  size = "lg",
  children,
}: RecordDialogProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const panel = panelRef.current;
    return () => {
      if (panel) dejarSalirCopia(panel);
    };
  }, []);

  return (
    <Sheet
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <SheetContent
        ref={panelRef}
        side="right"
        className={cn(
          "w-full max-w-[100vw] gap-0 overflow-hidden bg-card p-0 sm:max-w-[calc(100vw-3rem)] data-[state=closed]:duration-150 data-[state=open]:duration-200",
          ANCHOS[size],
        )}
      >
        <SheetHeader className="gap-0 border-b bg-muted/40 px-6 py-4 pr-12">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {icon}
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-lg">{title}</SheetTitle>
                <SheetDescription className={description ? "mt-1" : "sr-only"}>
                  {description ?? "Detalle del registro"}
                </SheetDescription>
              </div>
            </div>
            {headerActions && (
              <div className="flex shrink-0 items-center gap-2">
                {headerActions}
              </div>
            )}
          </div>
          {summary && <div className="mt-3">{summary}</div>}
        </SheetHeader>
        {/* Un formulario (RecordForm) ocupa este espacio y scrollea por dentro, con
          el pie fijo; cualquier otro contenido scrollea acá */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};
