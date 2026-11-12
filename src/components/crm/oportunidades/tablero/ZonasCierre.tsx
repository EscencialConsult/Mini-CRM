import { Droppable } from "@hello-pangea/dnd";
import { CircleX, Trophy, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { PREFIJO_CIERRE, type Cierre } from "./cierre";

const ZONAS: {
  resultado: Cierre;
  etiqueta: string;
  Icono: LucideIcon;
  estilo: string;
  estiloEncima: string;
}[] = [
  {
    resultado: "ganada",
    etiqueta: "Ganada",
    Icono: Trophy,
    estilo: "border-success/50 text-success",
    estiloEncima: "bg-success/15 border-success",
  },
  {
    resultado: "perdida",
    etiqueta: "Perdida",
    Icono: CircleX,
    estilo: "border-destructive/50 text-destructive",
    estiloEncima: "bg-destructive/15 border-destructive",
  },
];

/**
 * Mientras se arrastra una tarjeta: soltarla acá la cierra (pide confirmar
 * en un diálogo). Fijas abajo de la pantalla, siempre a la vista.
 */
export const ZonasCierre = () => (
  <div
    role="group"
    aria-label="Cerrar la oportunidad"
    className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
  >
    <div className="pointer-events-auto grid w-full max-w-xl grid-cols-2 gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      {ZONAS.map(({ resultado, etiqueta, Icono, estilo, estiloEncima }) => (
        <Droppable
          key={resultado}
          droppableId={`${PREFIJO_CIERRE}${resultado}`}
        >
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors",
                estilo,
                snapshot.isDraggingOver && estiloEncima,
              )}
            >
              <Icono aria-hidden className="size-5" />
              {etiqueta}
              {/* Sin lugar para la tarjeta: la zona no crece al pasar por encima */}
              <div className="h-0 w-0 overflow-hidden">
                {provided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      ))}
    </div>
  </div>
);
