import { required, useGetOne } from "ra-core";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";

import {
  ENTREGA_A_COORDINAR,
  ENTREGAS_PEDIDO_CON_COORDINAR,
} from "../domain/options";
import type { Cliente, EntregaPedido, Pedido } from "../domain/types";
import { LINEA_VACIA } from "../oportunidades/lineasProductos";
import { LineasProductosInput } from "../oportunidades/LineasProductosInput";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { SeccionFormulario } from "../shared/SeccionFormulario";

const aNulo = (valor: string): string | null => valor.trim() || null;

/**
 * Al elegir un cliente, su domicilio aparece como dirección sugerida (editable
 * para este pedido). No pisa lo que la persona ya escribió: solo completa el
 * campo si está vacío o si todavía tiene la sugerencia anterior.
 */
const useDireccionSugerida = (entrega: EntregaPedido | null | undefined) => {
  const { getValues, setValue } = useFormContext();
  const clienteId = useWatch({ name: "cliente_id" }) as number | undefined;
  const { data: cliente } = useGetOne<Cliente>(
    "clientes",
    { id: clienteId },
    { enabled: clienteId != null },
  );
  const sugeridaAntes = useRef<string | null>(null);
  const sugerida = cliente?.direccion ?? null;

  useEffect(() => {
    if (!cliente || entrega === "retiro") return;
    const actual = (getValues("direccion") as string | null | undefined) ?? "";
    if (actual === "" || actual === sugeridaAntes.current) {
      setValue("direccion", sugerida, { shouldDirty: true });
    }
    sugeridaAntes.current = sugerida;
  }, [cliente, sugerida, entrega, getValues, setValue]);

  return sugerida;
};

const CamposPedido = () => {
  const entrega = useWatch({ name: "tipo_entrega" }) as
    EntregaPedido | null | undefined;
  const direccionDelCliente = useDireccionSugerida(entrega);

  return (
    <>
      <SeccionFormulario titulo="Cliente y entrega">
        <ReferenceInput
          source="cliente_id"
          reference="clientes"
          sort={{ field: "nombre_completo", order: "ASC" }}
          perPage={20}
        >
          <AutocompleteInput
            label="Cliente"
            optionText="nombre_completo"
            validate={required()}
          />
        </ReferenceInput>
        <RadioButtonGroupInput
          source="tipo_entrega"
          label="Tipo de entrega"
          choices={ENTREGAS_PEDIDO_CON_COORDINAR}
          // «A coordinar» se guarda como nulo
          format={(valor: EntregaPedido | null | undefined) =>
            valor ?? ENTREGA_A_COORDINAR
          }
          parse={(valor: string) =>
            valor === ENTREGA_A_COORDINAR ? null : valor
          }
        />
        {entrega !== "retiro" && (
          <TextInput
            source="direccion"
            label="Dirección de entrega"
            parse={aNulo}
            helperText={
              direccionDelCliente
                ? "Sugerida desde el cliente: podés cambiarla para este pedido."
                : entrega === null
                  ? "Opcional: si todavía no se define la entrega, podés dejarla vacía."
                  : "Si la dejás vacía, se usa la dirección del cliente."
            }
          />
        )}
        <DateTimeInput
          source="entrega_en"
          label="Fecha y hora de entrega"
          helperText="Vacía: el pedido es para ahora."
        />
      </SeccionFormulario>

      <SeccionFormulario titulo="Productos">
        <LineasProductosInput />
      </SeccionFormulario>

      <SeccionFormulario titulo="Nota">
        <TextInput
          source="nota"
          label="Nota (opcional)"
          multiline
          rows={3}
          parse={aNulo}
        />
      </SeccionFormulario>
    </>
  );
};

interface PedidoFormDialogProps {
  /** Con id edita; sin id crea. */
  id?: string;
  onClose: () => void;
}

/**
 * Alta y edición de un pedido cargado por el equipo. El estado no se toca
 * acá: se cambia desde el detalle. Los precios salen del catálogo y el total
 * lo calcula la base.
 */
export const PedidoFormDialog = ({ id, onClose }: PedidoFormDialogProps) => (
  <RecordFormDialog<Pedido>
    resource="pedidos"
    id={id}
    size="lg"
    tituloCrear="Nuevo pedido"
    tituloEditar={(pedido) => `Editar pedido #${pedido.id}`}
    descripcion="Cliente, entrega y productos. Nace en «Nuevo»; después se avanza el estado desde el detalle."
    mensajeGuardado="Pedido guardado"
    defaultValues={{
      // Por defecto, envío; «A coordinar» se elige a mano
      tipo_entrega: "envio",
      productos: [{ ...LINEA_VACIA }],
    }}
    onClose={onClose}
  >
    <CamposPedido />
  </RecordFormDialog>
);
