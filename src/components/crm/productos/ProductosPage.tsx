import { Plus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatMoneda } from "../domain/format";
import type { Producto } from "../domain/types";
import { Pill } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { ProductoFormDialog } from "./ProductoFormDialog";

const ESTADOS_PRODUCTO = [
  { id: "true", name: "Activos" },
  { id: "false", name: "Inactivos" },
];

const columnas: ColumnaLista<Producto>[] = [
  {
    id: "nombre",
    encabezado: "Producto",
    orden: "nombre",
    celda: (producto) => (
      <span className="block">
        {producto.nombre}
        {producto.descripcion && (
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {producto.descripcion}
          </span>
        )}
      </span>
    ),
  },
  {
    id: "precio",
    encabezado: "Precio de lista",
    orden: "precio",
    alinear: "derecha",
    etiquetaTarjeta: "Precio de lista",
    celda: (producto) => formatMoneda(producto.precio),
  },
  {
    id: "activo",
    encabezado: "Estado",
    orden: "activo",
    etiquetaTarjeta: "Estado",
    celda: (producto) =>
      producto.activo ? (
        <Pill tono="exito">Activo</Pill>
      ) : (
        <Pill>Inactivo</Pill>
      ),
  },
  {
    id: "oportunidades",
    encabezado: "Oportunidades",
    orden: "oportunidades",
    alinear: "derecha",
    etiquetaTarjeta: "Oportunidades",
    celda: (producto) => producto.oportunidades ?? 0,
  },
];

/** Catálogo de productos (módulo Productos): precio de lista, altas y bajas. */
export const ProductosPage = () => {
  const ruta = useRecordRoute("productos");
  const cerrar = useCloseRecord("productos");

  return (
    <>
      <CrmList<Producto>
        resource="productos"
        titulo="Productos"
        sort={{ field: "nombre", order: "ASC" }}
        buscar="Buscar por nombre o descripción"
        filtros={
          <FilterSelect
            source="activo"
            etiqueta="Estado"
            opciones={ESTADOS_PRODUCTO}
            convertir={(id) => id === "true"}
          />
        }
        acciones={
          <Button asChild>
            <Link to="/productos/create">
              <Plus />
              Nuevo producto
            </Link>
          </Button>
        }
        columnas={columnas}
        tituloFila={(producto) => producto.nombre}
        hrefDe={(producto) => `/productos/${producto.id}`}
        vacio="Todavía no hay productos. Creá el primero con “Nuevo producto”."
      />
      {ruta.mode === "create" && <ProductoFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <ProductoFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
