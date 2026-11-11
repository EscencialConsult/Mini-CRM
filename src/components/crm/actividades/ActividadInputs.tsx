import { required, useGetList } from "ra-core";
import { useWatch } from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";

import type { Oportunidad, TipoActividad } from "../domain/types";
import { SelectInputOpcional } from "../shared/SelectInputOpcional";
import { ResponsablesInput } from "../shared/ResponsablesInput";
import { SeccionFormulario } from "../shared/SeccionFormulario";
import { FechaTareaInput } from "./FechaTareaInput";
import { TipoTareaInput } from "./TipoTareaInput";

interface ActividadInputsProps {
  /** El cliente viene dado (alta desde la ficha del cliente): no se elige. */
  clienteFijo?: boolean;
}

const aNulo = (valor: string): string | null => valor.trim() || null;

/** Oportunidades abiertas o cerradas del cliente elegido, para vincular la tarea. */
const OportunidadDelCliente = () => {
  const clienteId = useWatch({ name: "cliente_id" }) as number | undefined;
  const { data } = useGetList<Oportunidad>(
    "oportunidades",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "creado_en", order: "DESC" },
      filter: { cliente_id: clienteId },
    },
    { enabled: clienteId !== undefined && clienteId !== null },
  );

  return (
    <SelectInputOpcional
      source="oportunidad_id"
      label="Oportunidad (opcional)"
      choices={data ?? []}
      optionText="producto_servicio"
      emptyText="Ninguna"
      disabled={!clienteId}
    />
  );
};

/** Campos de la tarea (alta y edición), en secciones. Va dentro de un <Form>. */
export const ActividadInputs = ({ clienteFijo }: ActividadInputsProps) => {
  const tipo = useWatch({ name: "tipo" }) as TipoActividad | undefined;
  const esNota = tipo === "nota";

  return (
    <>
      <TipoTareaInput />
      <TextInput
        source="titulo"
        label={esNota ? "Título de la nota" : "Asunto"}
        validate={required()}
        parse={aNulo}
      />
      <TextInput
        source="descripcion"
        label={esNota ? "Nota" : "Detalle o resultado"}
        multiline
        rows={esNota ? 5 : 3}
        parse={aNulo}
      />

      {/* Las notas no se programan ni tienen responsables */}
      {!esNota && (
        <SeccionFormulario titulo="Cuándo y quién">
          <FechaTareaInput tipo={tipo ?? "tarea"} />
          <ResponsablesInput />
        </SeccionFormulario>
      )}

      <SeccionFormulario titulo="Relacionada con">
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
          <OportunidadDelCliente />
        </div>
      </SeccionFormulario>
    </>
  );
};
