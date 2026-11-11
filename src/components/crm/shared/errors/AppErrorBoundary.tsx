import type { ErrorInfo, ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { construirReporte } from "./errorReport";
import { ErrorDetalle } from "./ErrorDetalle";

interface FallbackProps {
  error: unknown;
}

/** Pantalla de error de la raíz: nunca queda en blanco. */
const PantallaDeError = ({
  error,
  componentes,
}: FallbackProps & { componentes?: string }) => (
  <main className="flex min-h-svh items-center justify-center bg-background p-6">
    <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
      <ErrorDetalle
        reporte={construirReporte(error, {
          pantalla: window.location.hash || window.location.pathname,
          componentes,
        })}
      />
    </div>
  </main>
);

/** Error boundary de la raíz: errores de render y de efectos. */
export const AppErrorBoundary = ({ children }: { children: ReactNode }) => {
  let componentes: string | undefined;
  return (
    <ErrorBoundary
      onError={(_error, info: ErrorInfo) => {
        componentes = info.componentStack ?? undefined;
      }}
      fallbackRender={({ error }) => (
        <PantallaDeError error={error} componentes={componentes} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
};
