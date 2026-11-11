import { required, useGetList } from "ra-core";
import { useWatch } from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { TIPOS_ACTIVIDAD } from "../domain/options";
import type { Oportunidad, TipoActividad } from "../domain/types";
import { SelectInputOpcional } from "../shared/SelectInputOpcional";
import { useUsuarios } from "../shared/useUsuarios";

interface ActividadInputsProps {
  /** El cliente viene dado (alta desde la ficha del cliente): no se elige. */
  clienteFijo?: boolean;
}

const aNulo = (valor: string): string | null => valor.trim() || null;

const ETIQUETA_FECHA: Record<TipoActividad, string> = {
  llamada: "Fecha y hora de la llamada",
  reunion: "Fecha y hora de la reunión",
  nota: "Fecha",
  tarea: "Vence",
};

const ETIQUETA_REALIZADA: Record<TipoActividad, string> = {
  llamada: "Ya se realizó (si no, queda programada)",
  reunion: "Ya se realizó (si no, queda programada)",
  nota: "",
  tarea: "Tarea completada",
};

/** Oportunidades abiertas o cerradas del cliente elegido, para vincular la actividad. */
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

/** Campos de la actividad (alta y edición). Va dentro de un <Form>. */
export const ActividadInputs = ({ clienteFijo }: ActividadInputsProps) => {
  const { opcionesActivas } = useUsuarios();
  const tipo = useWatch({ name: "tipo" }) as TipoActividad | undefined;
  const esNota = tipo === "nota";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          source="tipo"
          label="Tipo de actividad"
          choices={TIPOS_ACTIVIDAD}
          validate={required()}
        />
        {!esNota && (
          <DateTimeInput
            source="fecha"
            label={ETIQUETA_FECHA[tipo ?? "tarea"]}
            validate={required()}
          />
        )}
      </div>

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

      {!esNota && (
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <SelectInputOpcional
            source="asignado_a"
            label="Responsable"
            choices={opcionesActivas}
            emptyText="Sin asignar"
          />
          <BooleanInput
            source="completada"
            label={ETIQUETA_REALIZADA[tipo ?? "tarea"]}
          />
        </div>
      )}
    </>
  );
};
