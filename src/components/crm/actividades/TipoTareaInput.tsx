import { FieldTitle, required, useInput } from "ra-core";

import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { TIPOS_ACTIVIDAD } from "../domain/options";
import type { TipoActividad } from "../domain/types";
import { ICONOS_ACTIVIDAD } from "./iconosActividad";

const esTipo = (valor: string): valor is TipoActividad =>
  TIPOS_ACTIVIDAD.some((tipo) => tipo.id === valor);

/** Tipo de tarea como botones con ícono (siempre hay uno elegido). */
export const TipoTareaInput = () => {
  const { field, id, isRequired } = useInput({
    source: "tipo",
    validate: required(),
  });

  return (
    <FormField id={id} name={field.name}>
      <FormLabel>
        <FieldTitle label="Tipo" source="tipo" isRequired={isRequired} />
      </FormLabel>
      <FormControl>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={field.value ?? ""}
          // Tocar el elegido no lo deselecciona
          onValueChange={(valor) => {
            if (esTipo(valor)) field.onChange(valor);
          }}
          onBlur={field.onBlur}
          className="grid w-full grid-cols-2 sm:grid-cols-4"
        >
          {TIPOS_ACTIVIDAD.map((tipo) => {
            const Icono = ICONOS_ACTIVIDAD[tipo.id];
            return (
              <ToggleGroupItem
                key={tipo.id}
                value={tipo.id}
                className="w-full gap-2 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <Icono aria-hidden />
                {tipo.name}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </FormControl>
      <FormError />
    </FormField>
  );
};
