import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { ETAPAS, RESULTADOS, probabilidadDeEtapa } from "../domain/options";
import type { Etapa, Resultado } from "../domain/types";
import { validarImporte, validarProbabilidad } from "../domain/validators";
import { SelectInputOpcional } from "../shared/SelectInputOpcional";
import { useUsuarios } from "../shared/useUsuarios";

interface OportunidadInputsProps {
  /** El cliente viene dado (alta desde la ficha del cliente): no se elige. */
  clienteFijo?: boolean;
}

const aNulo = (valor: string): string | null => valor.trim() || null;

/** Campos de la oportunidad (alta y edición). Va dentro de un <Form>. */
export const OportunidadInputs = ({ clienteFijo }: OportunidadInputsProps) => {
  const { setValue } = useFormContext();
  const { opcionesActivas } = useUsuarios();
  const resultado = useWatch({ name: "resultado" }) as Resultado | undefined;
  const cerrada = resultado !== undefined && resultado !== "abierta";

  return (
    <>
      {!clienteFijo && (
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
      )}

      <TextInput
        source="producto_servicio"
        label="Producto o servicio de interés"
        validate={required()}
        parse={aNulo}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          source="importe_estimado"
          label="Importe estimado (ARS)"
          min={0}
          validate={validarImporte}
        />
        <SelectInput
          source="etapa"
          label="Etapa de negociación"
          choices={ETAPAS}
          validate={required()}
          onChange={(etapa) =>
            setValue("probabilidad", probabilidadDeEtapa(etapa as Etapa), {
              shouldDirty: true,
            })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          source="probabilidad"
          label="Probabilidad de cierre (%)"
          min={0}
          max={100}
          disabled={cerrada}
          validate={validarProbabilidad}
          helperText={
            cerrada
              ? "Se fija sola: 100 % si se ganó, 0 % si se perdió."
              : "Se sugiere según la etapa; podés ajustarla."
          }
        />
        <DateInput source="fecha_cierre_estimada" label="Cierre estimado" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          source="resultado"
          label="Resultado"
          choices={RESULTADOS}
          validate={required()}
        />
        <SelectInputOpcional
          source="asignado_a"
          label="Responsable"
          choices={opcionesActivas}
          emptyText="Sin asignar"
        />
      </div>

      {resultado === "perdida" && (
        <TextInput
          source="motivo_perdida"
          label="Motivo de la pérdida"
          parse={aNulo}
        />
      )}

      <TextInput
        source="descripcion"
        label="Detalle"
        multiline
        rows={3}
        parse={aNulo}
      />
    </>
  );
};
