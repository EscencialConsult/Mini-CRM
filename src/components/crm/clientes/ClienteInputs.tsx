import { required } from "ra-core";
import { useWatch } from "react-hook-form";

import { DateInput } from "@/components/admin/date-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { ESTADOS_CLIENTE, TIPOS_CLIENTE } from "../domain/options";
import type { TipoCliente } from "../domain/types";
import {
  soloDigitos,
  validarDocumento,
  validarEmail,
  validarTelefono,
} from "../domain/validators";
import { useEsAdministrador } from "../providers/authProvider";
import { SelectInputOpcional } from "../shared/SelectInputOpcional";
import { useUsuarios } from "../shared/useUsuarios";

const aNulo = (valor: string): string | null => valor.trim() || null;

/** Campos del cliente (alta y edición). Va dentro de un <Form>. */
export const ClienteInputs = () => {
  const esAdministrador = useEsAdministrador();
  const { opcionesActivas } = useUsuarios();
  const tipo = useWatch({ name: "tipo" }) as TipoCliente | undefined;

  return (
    <>
      <RadioButtonGroupInput
        source="tipo"
        label="Tipo de cliente"
        choices={TIPOS_CLIENTE}
        validate={required()}
      />

      {tipo === "empresa" ? (
        <TextInput
          source="razon_social"
          label="Razón social"
          validate={required()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput source="nombre" label="Nombre" validate={required()} />
          <TextInput source="apellido" label="Apellido" validate={required()} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          source="documento"
          label="CUIT / DNI"
          inputMode="numeric"
          parse={(valor: string) => soloDigitos(valor) || null}
          validate={validarDocumento}
          helperText="Solo números: DNI (7-8 dígitos) o CUIT/CUIL (11)."
        />
        <SelectInput
          source="estado"
          label="Estado"
          choices={ESTADOS_CLIENTE}
          validate={required()}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          source="telefono"
          label="Teléfono"
          type="tel"
          parse={aNulo}
          validate={validarTelefono}
        />
        <TextInput
          source="email"
          label="Email"
          type="email"
          parse={(valor: string) => valor.trim().toLowerCase() || null}
          validate={validarEmail}
        />
      </div>

      <TextInput source="direccion" label="Dirección" parse={aNulo} />

      <div className="grid gap-4 sm:grid-cols-2">
        <DateInput source="proximo_contacto" label="Próximo contacto" />
        {esAdministrador && (
          <SelectInputOpcional
            source="asignado_a"
            label="Vendedor asignado"
            choices={opcionesActivas}
            emptyText="Sin asignar"
          />
        )}
      </div>
    </>
  );
};
