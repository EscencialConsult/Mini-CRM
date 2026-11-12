import { useWatch } from "react-hook-form";

import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";

import { useUsuarios } from "./useUsuarios";

/**
 * Responsables de una oportunidad o tarea (campo `asignados`), todos iguales.
 * Se puede sumar a usuarios activos; uno desactivado que ya estaba se sigue
 * viendo y se puede quitar. Vacío = sin asignar.
 */
export const ResponsablesInput = () => {
  const asignados = useWatch({ name: "asignados" }) as string[] | undefined;
  const { usuarios, opcionesTodas } = useUsuarios();
  const elegibles = new Set(
    usuarios
      .filter((usuario) =>
        usuario.sistema
          ? asignados?.includes(usuario.id)
          : usuario.activo || asignados?.includes(usuario.id),
      )
      .map((usuario) => usuario.id),
  );

  return (
    <AutocompleteArrayInput
      source="asignados"
      label="Responsables"
      choices={opcionesTodas.filter((opcion) => elegibles.has(opcion.id))}
      placeholder="Agregar responsable…"
      helperText="Sin responsables queda sin asignar."
    />
  );
};
