import { Copy, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { ErrorReport } from "./errorReport";

interface ErrorDetalleProps {
  reporte: ErrorReport;
  /** Acción de recuperación adicional (por ejemplo, volver a intentar). */
  onCerrar?: () => void;
}

/**
 * Aviso de error en dos niveles: qué hacer (copiar el detalle y enviárselo al
 * administrador, o recargar) y el detalle técnico desplegable.
 */
export const ErrorDetalle = ({ reporte, onCerrar }: ErrorDetalleProps) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(reporte.detalle);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div role="alert" className="space-y-4">
      <div className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-destructive"
        />
        <div className="space-y-1">
          <p className="font-medium">{reporte.resumen}</p>
          <p className="text-sm text-muted-foreground">
            Copiá el detalle y enviáselo al administrador del sistema.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copiar()}
        >
          <Copy />
          {copiado ? "Detalle copiado" : "Copiar detalle"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw />
          Recargar
        </Button>
        {onCerrar && (
          <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        )}
      </div>
      <details className="rounded-md border bg-muted/40 p-3 text-xs">
        <summary className="cursor-pointer font-medium">
          Detalle técnico
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">
          {reporte.detalle}
        </pre>
      </details>
    </div>
  );
};
