import { Plus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha } from "../domain/format";
import type { Etiqueta } from "../domain/types";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { EtiquetaChip } from "./EtiquetaChip";
import { EtiquetaFormDialog } from "./EtiquetaFormDialog";

const columnas: ColumnaLista<Etiqueta>[] = [
  {
    id: "nombre",
    encabezado: "Etiqueta",
    orden: "nombre",
    celda: (etiqueta) => (
      <EtiquetaChip nombre={etiqueta.nombre} color={etiqueta.color} />
    ),
  },
  {
    id: "clientes",
    encabezado: "Clientes",
    orden: "clientes",
    alinear: "derecha",
    etiquetaTarjeta: "Clientes",
    celda: (etiqueta) => etiqueta.clientes ?? 0,
  },
  {
    id: "alta",
    encabezado: "Creada",
    orden: "creado_en",
    etiquetaTarjeta: "Creada",
    celda: (etiqueta) => (
      <span className="block">
        {formatFecha(etiqueta.creado_en)}
        {etiqueta.creado_por_nombre && (
          <span className="block text-xs text-muted-foreground">
            por {etiqueta.creado_por_nombre}
          </span>
        )}
      </span>
    ),
  },
];

/**
 * Catálogo de etiquetas (solo administradores): renombrar, cambiar el color o
 * borrar. Se crean también desde la ficha de cualquier cliente.
 */
export const EtiquetasPage = () => {
  const ruta = useRecordRoute("etiquetas");
  const cerrar = useCloseRecord("etiquetas");

  return (
    <>
      <CrmList<Etiqueta>
        resource="etiquetas"
        titulo="Etiquetas"
        sort={{ field: "nombre", order: "ASC" }}
        acciones={
          <Button asChild>
            <Link to="/etiquetas/create">
              <Plus />
              Nueva etiqueta
            </Link>
          </Button>
        }
        columnas={columnas}
        tituloFila={(etiqueta) => etiqueta.nombre}
        hrefDe={(etiqueta) => `/etiquetas/${etiqueta.id}`}
        vacio="Todavía no hay etiquetas. Creá una acá o escribiéndola en la ficha de un cliente."
      />
      {ruta.mode === "create" && <EtiquetaFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <EtiquetaFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
