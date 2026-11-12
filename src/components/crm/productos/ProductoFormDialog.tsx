import { Archive, ArchiveRestore } from "lucide-react";
import { maxLength, minValue, required } from "ra-core";

import { NumberInput } from "@/components/admin/number-input";
import { TextInput } from "@/components/admin/text-input";

import { plural } from "../domain/format";
import type { Producto } from "../domain/types";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { GuardarCon } from "../shared/RecordForm";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { useRefrescarProductos } from "./useProductos";

const aNulo = (valor: string): string | null => valor.trim() || null;

const enUso = (producto: Producto) =>
  !!producto.oportunidades || !!producto.pedidos;

const usoDe = (producto: Producto) => {
  const lugares = [
    producto.oportunidades
      ? plural(producto.oportunidades, "oportunidad", "oportunidades")
      : null,
    producto.pedidos ? plural(producto.pedidos, "pedido", "pedidos") : null,
  ].filter(Boolean);
  const uso = lugares.length
    ? `Está en ${lugares.join(" y ")}: no se puede borrar, se desactiva.`
    : "Ninguna oportunidad ni pedido lo tiene todavía.";
  return producto.activo
    ? uso
    : `Inactivo: no se puede agregar a oportunidades ni pedidos. ${uso}`;
};

/**
 * Alta y edición de un producto del catálogo. Uno en uso no se borra: se
 * desactiva y deja de ofrecerse (las oportunidades que lo tienen lo conservan).
 */
export const ProductoFormDialog = ({
  id,
  onClose,
}: {
  id?: string;
  onClose: () => void;
}) => {
  const refrescarProductos = useRefrescarProductos();
  const alTerminar = () => {
    void refrescarProductos();
    onClose();
  };

  return (
    <RecordFormDialog<Producto>
      resource="productos"
      id={id}
      tituloCrear="Nuevo producto"
      tituloEditar={(producto) => producto.nombre}
      descripcion="Nombre y precio de lista; el precio se puede ajustar en cada oportunidad."
      descripcionEditar={usoDe}
      mensajeGuardado="Producto guardado"
      defaultValues={{ precio: 0, activo: true }}
      size="md"
      onClose={onClose}
      onSaved={alTerminar}
      acciones={(producto) =>
        enUso(producto) ? null : (
          <DeleteRecordButton
            resource="productos"
            id={producto.id}
            previousData={producto}
            descripcion={`el producto «${producto.nombre}»`}
            onDeleted={alTerminar}
          />
        )
      }
      guardadosExtra={(producto) =>
        producto &&
        (producto.activo ? (
          <GuardarCon
            etiqueta="Desactivar"
            icono={<Archive />}
            valores={{ activo: false }}
          />
        ) : (
          <GuardarCon
            etiqueta="Activar"
            icono={<ArchiveRestore />}
            valores={{ activo: true }}
          />
        ))
      }
    >
      <TextInput
        source="nombre"
        label="Nombre"
        validate={[required(), maxLength(80)]}
      />
      <NumberInput
        source="precio"
        label="Precio de lista (ARS)"
        min={0}
        step={0.01}
        validate={[required(), minValue(0, "El precio no puede ser negativo")]}
      />
      <TextInput
        source="descripcion"
        label="Descripción"
        multiline
        rows={3}
        parse={aNulo}
      />
    </RecordFormDialog>
  );
};
