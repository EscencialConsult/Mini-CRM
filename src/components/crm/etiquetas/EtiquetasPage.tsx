import { Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { Etiqueta } from "../domain/types";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { EtiquetaFila } from "./EtiquetaFila";
import { EtiquetaFormDialog } from "./EtiquetaFormDialog";

const Catalogo = () => {
  const { data, isPending, error, refetch } = useGetList<Etiqueta>(
    "etiquetas",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "nombre", order: "ASC" },
    },
  );

  if (isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton key={indice} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p className="text-destructive">No se pudieron cargar las etiquetas.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
        >
          Reintentar
        </Button>
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay etiquetas. Creá una acá o escribiéndola en la ficha de un
        cliente.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((etiqueta) => (
        <EtiquetaFila key={etiqueta.id} etiqueta={etiqueta} />
      ))}
    </ul>
  );
};

/**
 * Catálogo de etiquetas (módulo Etiquetas), con edición rápida: el nombre se
 * cambia tocándolo, el color desde su punto y la papelera la borra. Se crean
 * también desde la ficha de cualquier cliente.
 */
export const EtiquetasPage = () => {
  const ruta = useRecordRoute("etiquetas");
  const cerrar = useCloseRecord("etiquetas");

  return (
    <section className="space-y-4 py-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Etiquetas</h1>
          <p className="text-sm text-muted-foreground">
            Tocá un nombre para renombrarla o el punto para cambiarle el color.
          </p>
        </div>
        <Button asChild>
          <Link to="/etiquetas/create">
            <Plus />
            Nueva etiqueta
          </Link>
        </Button>
      </header>
      <Catalogo />
      {ruta.mode === "create" && <EtiquetaFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <EtiquetaFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </section>
  );
};
