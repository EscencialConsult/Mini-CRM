import { required } from "ra-core";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";

import { DateInput } from "@/components/admin/date-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { TextInput } from "@/components/admin/text-input";

import { formatMoneda, hoyIso } from "../../domain/format";
import { MOTIVOS_PERDIDA } from "../../domain/options";
import type { Oportunidad } from "../../domain/types";
import { RecordFormDialog } from "../../shared/RecordFormDialog";
import { SeccionFormulario } from "../../shared/SeccionFormulario";
import { LineasProductosInput } from "../LineasProductosInput";
import type { Cierre } from "./cierre";

const aNulo = (valor: string): string | null => valor.trim() || null;

/** Fecha de cierre: hoy, salvo que ya tuviera una (se puede cambiar). */
const FechaCierreInput = () => {
  const { getValues, setValue } = useFormContext();
  useEffect(() => {
    if (!getValues("fecha_cierre")) setValue("fecha_cierre", hoyIso());
  }, [getValues, setValue]);
  return (
    <DateInput
      source="fecha_cierre"
      label="Fecha de cierre"
      validate={required()}
    />
  );
};

interface CerrarOportunidadDialogProps {
  oportunidad: Oportunidad;
  resultado: Cierre;
  onClose: () => void;
  /** Se llama con la oportunidad ya guardada como ganada o perdida. */
  onCerrada: (oportunidad: Oportunidad) => void;
}

/**
 * Cierre desde el tablero. Ganada: se confirman los productos (el importe
 * final) y la fecha. Perdida: el motivo, obligatorio, y un detalle opcional.
 */
export const CerrarOportunidadDialog = ({
  oportunidad,
  resultado,
  onClose,
  onCerrada,
}: CerrarOportunidadDialogProps) => {
  const ganada = resultado === "ganada";

  return (
    <RecordFormDialog<Oportunidad>
      resource="oportunidades"
      id={String(oportunidad.id)}
      size={ganada ? "lg" : "md"}
      tituloCrear=""
      tituloEditar={(registro) =>
        `${ganada ? "Ganada" : "Perdida"}: ${registro.producto_servicio}`
      }
      descripcionEditar={(registro) =>
        ganada
          ? `${registro.cliente_nombre ?? "Cliente"} · Confirmá los productos y el importe final (hoy, ${formatMoneda(registro.importe_estimado)}).`
          : `${registro.cliente_nombre ?? "Cliente"} · ¿Por qué se perdió? El motivo sirve para los reportes de ventas.`
      }
      mensajeGuardado={
        ganada ? "Oportunidad marcada como ganada" : "Oportunidad perdida"
      }
      submitLabel={ganada ? "Marcar ganada" : "Marcar perdida"}
      transform={(datos) => ({ ...datos, resultado })}
      onClose={onClose}
      onSaved={(registro) => {
        onCerrada(registro);
        onClose();
      }}
    >
      {ganada ? (
        <>
          <SeccionFormulario titulo="Productos">
            <LineasProductosInput />
          </SeccionFormulario>
          <SeccionFormulario titulo="Cierre">
            <div className="grid gap-4 sm:grid-cols-2">
              <FechaCierreInput />
            </div>
          </SeccionFormulario>
        </>
      ) : (
        <>
          <RadioButtonGroupInput
            source="motivo_perdida_tipo"
            label="Motivo"
            choices={MOTIVOS_PERDIDA}
            row={false}
            validate={required()}
          />
          <TextInput
            source="motivo_perdida"
            label="Detalle (opcional)"
            multiline
            rows={3}
            parse={aNulo}
          />
        </>
      )}
    </RecordFormDialog>
  );
};
