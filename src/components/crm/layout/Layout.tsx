import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { construirReporte } from "../shared/errors/errorReport";
import { ErrorDetalle } from "../shared/errors/ErrorDetalle";
import { GlobalErrorListener } from "../shared/errors/GlobalErrorListener";
import { AppSidebar } from "./AppSidebar";

export const Layout = ({ children }: { children: ReactNode }) => (
  <SidebarProvider>
    <a
      href="#contenido-principal"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
    >
      Saltar al contenido
    </a>
    <AppSidebar />
    <SidebarInset>
      <div className="flex h-10 items-center px-2 md:hidden">
        <SidebarTrigger aria-label="Abrir el menú" />
      </div>
      <main
        id="contenido-principal"
        className="mx-auto w-full max-w-screen-xl p-4"
      >
        {/* Un error de pantalla no tumba el menú: se muestra acá con su detalle */}
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <div className="rounded-xl border bg-card p-6">
              <ErrorDetalle
                reporte={construirReporte(error, {
                  pantalla: window.location.hash || window.location.pathname,
                })}
              />
            </div>
          )}
        >
          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </SidebarInset>
    <Notification />
    <GlobalErrorListener />
  </SidebarProvider>
);
