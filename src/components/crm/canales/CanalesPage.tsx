import { Plus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import type { Canal } from "../domain/types";
import { Pill } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { CanalFormDialog } from "./CanalFormDialog";

const columnas: ColumnaLista<Canal>[] = [
  {
    id: "nombre",
    encabezado: "Canal",
    orden: "nombre",
    celda: (canal) => (
      <span className="flex flex-wrap items-center gap-2">
        {canal.nombre}
        {canal.clave && <Pill tono="info">Del sistema</Pill>}
      </span>
    ),
  },
  {
    id: "activo",
    encabezado: "Estado",
    orden: "activo",
    etiquetaTarjeta: "Estado",
    celda: (canal) =>
      canal.activo ? <Pill tono="exito">Activo</Pill> : <Pill>Inactivo</Pill>,
  },
  {
    id: "clientes",
    encabezado: "Clientes",
    orden: "clientes",
    alinear: "derecha",
    etiquetaTarjeta: "Clientes",
    celda: (canal) => canal.clientes ?? 0,
  },
  {
    id: "oportunidades",
    encabezado: "Oportunidades",
    orden: "oportunidades",
    alinear: "derecha",
    etiquetaTarjeta: "Oportunidades",
    celda: (canal) => canal.oportunidades ?? 0,
  },
];

/** Catálogo de canales de venta (solo el administrador). */
export const CanalesPage = () => {
  const ruta = useRecordRoute("canales");
  const cerrar = useCloseRecord("canales");

  return (
    <>
      <CrmList<Canal>
        resource="canales"
        titulo="Canales de venta"
        sort={{ field: "nombre", order: "ASC" }}
        acciones={
          <Button asChild>
            <Link to="/canales/create">
              <Plus />
              Nuevo canal
            </Link>
          </Button>
        }
        columnas={columnas}
        tituloFila={(canal) => canal.nombre}
        hrefDe={(canal) => `/canales/${canal.id}`}
        vacio="Todavía no hay canales. Creá el primero con “Nuevo canal”."
      />
      {ruta.mode === "create" && <CanalFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <CanalFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
