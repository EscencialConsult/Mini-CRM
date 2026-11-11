import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useCrmIdentity } from "../../providers/authProvider";
import {
  construirReporte,
  esRuidoIgnorable,
  type ErrorReport,
} from "./errorReport";
import { ErrorDetalle } from "./ErrorDetalle";

/**
 * Manejador global: errores fuera del render (clics, timers, promesas sin
 * catch) muestran un aviso sin tumbar la pantalla. Los errores esperados
 * (validación, 4xx de negocio) se tratan donde ocurren con su toast.
 */
export const GlobalErrorListener = () => {
  const { identity } = useCrmIdentity();
  const [reporte, setReporte] = useState<ErrorReport | null>(null);
  const usuario = identity
    ? `${identity.fullName} <${identity.email}>`
    : undefined;

  useEffect(() => {
    const informar = (error: unknown) =>
      setReporte(
        construirReporte(error, {
          usuario,
          pantalla: window.location.hash || window.location.pathname,
        }),
      );

    const alError = (evento: ErrorEvent) => {
      if (esRuidoIgnorable(evento.error ?? evento.message, evento.filename))
        return;
      informar(evento.error ?? evento.message);
    };
    const alRechazo = (evento: PromiseRejectionEvent) => {
      if (esRuidoIgnorable(evento.reason)) return;
      informar(evento.reason);
    };

    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, [usuario]);

  return (
    <Dialog
      open={reporte !== null}
      onOpenChange={(abierto) => !abierto && setReporte(null)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Algo salió mal</DialogTitle>
          <DialogDescription className="sr-only">
            Error inesperado de la aplicación
          </DialogDescription>
        </DialogHeader>
        {reporte && (
          <ErrorDetalle reporte={reporte} onCerrar={() => setReporte(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
};
