import { useInput } from "ra-core";
import type { ReactNode } from "react";

import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";

import { SelectorEtiquetas } from "./SelectorEtiquetas";

const SIN_ETIQUETAS: number[] = [];
// Registros guardados antes de que existieran las etiquetas llegan sin la lista
const aLista = (valor: unknown) =>
  Array.isArray(valor) ? (valor as number[]) : SIN_ETIQUETAS;

/** Campo `etiquetas` de un formulario: va dentro de un <Form>. */
export const EtiquetasInput = ({
  label = "Etiquetas",
  helperText,
}: {
  label?: string;
  helperText?: ReactNode;
}) => {
  const { id, field } = useInput({ source: "etiquetas", format: aLista });

  return (
    <FormField id={id} name={field.name}>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <SelectorEtiquetas
          value={aLista(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
