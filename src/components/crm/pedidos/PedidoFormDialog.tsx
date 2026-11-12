import { required } from "ra-core";
import { useWatch } from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";

import {
  ENTREGA_A_COORDINAR,
  ENTREGAS_PEDIDO_CON_COORDINAR,
} from "../domain/options";
import type { EntregaPedido, Pedido } from "../domain/types";
import { LINEA_VACIA } from "../oportunidades/lineasProductos";
import { LineasProductosInput } from "../oportunidades/LineasProductosInput";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { SeccionFormulario } from "../shared/SeccionFormulario";

const aNulo = (valor: string): string | null => valor.trim() || null;

const CamposPedido = () => {
  const entrega = useWatch({ name: "tipo_entrega" }) as
    EntregaPedido | null | undefined;

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
              entrega === null
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
