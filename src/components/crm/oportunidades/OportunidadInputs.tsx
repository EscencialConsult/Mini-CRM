import { required, useGetOne } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { CanalInput } from "../canales/CanalInput";
import {
  ETAPAS,
  MOTIVOS_PERDIDA,
  RESULTADOS,
  probabilidadDeEtapa,
} from "../domain/options";
import type { Cliente, Etapa, Resultado } from "../domain/types";
import { validarProbabilidad } from "../domain/validators";
import { ResponsablesInput } from "../shared/ResponsablesInput";
import { SeccionFormulario } from "../shared/SeccionFormulario";
import { LineasProductosInput } from "./LineasProductosInput";

interface OportunidadInputsProps {
  /** El cliente viene dado (alta desde la ficha del cliente): no se elige. */
  clienteFijo?: boolean;
}

const aNulo = (valor: string): string | null => valor.trim() || null;

/** Sin canal elegido, toma el de origen del cliente al elegirlo (se puede cambiar). */
const useCanalDelCliente = () => {
  const { getValues, setValue } = useFormContext();
  const clienteId = useWatch({ name: "cliente_id" }) as number | undefined;
  const { data: cliente } = useGetOne<Cliente>(
    "clientes",
    { id: clienteId! },
    { enabled: !!clienteId },
  );
  const canalCliente = cliente?.id === clienteId ? cliente?.canal_id : null;

  useEffect(() => {
    if (canalCliente && getValues("canal_id") == null) {
      setValue("canal_id", canalCliente, { shouldDirty: true });
    }
  }, [canalCliente, getValues, setValue]);
};

/** Campos de la oportunidad (alta y edición). Va dentro de un <Form>. */
export const OportunidadInputs = ({ clienteFijo }: OportunidadInputsProps) => {
  const { setValue } = useFormContext();
  const resultado = useWatch({ name: "resultado" }) as Resultado | undefined;
  const cerrada = resultado !== undefined && resultado !== "abierta";
  useCanalDelCliente();

  return (
    <>
      <SeccionFormulario titulo={clienteFijo ? "Canal" : "Cliente y canal"}>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <CanalInput
            label="Canal"
            helperText="Por defecto, el de origen del cliente."
          />
        </div>
      </SeccionFormulario>

      <SeccionFormulario titulo="Productos">
        <LineasProductosInput />
      </SeccionFormulario>

      <SeccionFormulario titulo="Negociación">
        <div className="grid gap-4 sm:grid-cols-2">
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
          <SelectInput
            source="resultado"
            label="Resultado"
            choices={RESULTADOS}
            validate={required()}
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
        <ResponsablesInput />

        {cerrada && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput
              source="fecha_cierre"
              label="Fecha de cierre"
              helperText="Vacía: hoy."
            />
            {resultado === "perdida" && (
              <SelectInput
                source="motivo_perdida_tipo"
                label="Motivo de la pérdida"
                choices={MOTIVOS_PERDIDA}
                validate={required()}
              />
            )}
          </div>
        )}
        {resultado === "perdida" && (
          <TextInput
            source="motivo_perdida"
            label="Detalle de la pérdida (opcional)"
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
      </SeccionFormulario>
    </>
  );
};
