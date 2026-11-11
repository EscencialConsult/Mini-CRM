import { FieldTitle, required, useInput } from "ra-core";
import { useWatch } from "react-hook-form";

import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { COLORES_ETIQUETA } from "../domain/options";
import type { ColorEtiqueta } from "../domain/types";
import { EtiquetaChip } from "./EtiquetaChip";
import { PUNTO_ETIQUETA } from "./estiloEtiqueta";

const esColor = (valor: string): valor is ColorEtiqueta =>
  COLORES_ETIQUETA.some((color) => color.id === valor);

/** Color de la etiqueta (siempre hay uno elegido), con la vista previa del chip. */
export const ColorEtiquetaInput = () => {
  const { field, id, isRequired } = useInput({
    source: "color",
    validate: required(),
  });
  const nombre = useWatch({ name: "nombre" }) as string | undefined;
  const color = esColor(field.value ?? "") ? field.value : "gris";

  return (
    <FormField id={id} name={field.name}>
      <FormLabel>
        <FieldTitle label="Color" source="color" isRequired={isRequired} />
      </FormLabel>
      <FormControl>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={field.value ?? ""}
          // Tocar el elegido no lo deselecciona
          onValueChange={(valor) => {
            if (esColor(valor)) field.onChange(valor);
          }}
          onBlur={field.onBlur}
          className="flex flex-wrap"
        >
          {COLORES_ETIQUETA.map((opcion) => (
            <ToggleGroupItem
              key={opcion.id}
              value={opcion.id}
              aria-label={opcion.name}
              title={opcion.name}
              className="size-9 p-0 data-[state=on]:border-primary data-[state=on]:ring-2 data-[state=on]:ring-primary/40"
            >
              <span
                aria-hidden
                className={cn("size-4 rounded-full", PUNTO_ETIQUETA[opcion.id])}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FormControl>
      <FormError />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Así se ve:
        <EtiquetaChip nombre={nombre?.trim() || "Etiqueta"} color={color} />
      </div>
    </FormField>
  );
};
