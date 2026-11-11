import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Datos que dependen entre sí (contadores de la ficha del cliente, panel,
// recordatorios): se invalidan juntos y solo se vuelven a pedir los que están en pantalla.
const CLAVES_DERIVADAS = [
  "clientes",
  "oportunidades",
  "actividades",
  "panel",
  "recordatorios",
] as const;

export const useRefrescarDatos = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all(
        CLAVES_DERIVADAS.map((clave) =>
          queryClient.invalidateQueries({ queryKey: [clave] }),
        ),
      ),
    [queryClient],
  );
};
