import { useQueryClient } from "@tanstack/react-query";
import { useGetList } from "ra-core";
import { useCallback, useMemo } from "react";

import type { Etiqueta } from "../domain/types";

const CINCO_MINUTOS = 5 * 60 * 1000;

/**
 * Catálogo de etiquetas (id, nombre y color) para chips, filtros y el
 * selector: se pide una vez y lo comparten todas las pantallas.
 */
export const useEtiquetas = () => {
  const { data, isPending } = useGetList<Etiqueta>(
    "etiquetas",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "nombre", order: "ASC" },
      meta: { columns: ["id", "nombre", "color"] },
    },
    { staleTime: CINCO_MINUTOS },
  );

  return useMemo(() => {
    const etiquetas = data ?? [];
    return {
      isPending,
      etiquetas,
      porId: new Map(etiquetas.map((etiqueta) => [etiqueta.id, etiqueta])),
    };
  }, [data, isPending]);
};

/** Vuelve a pedir el catálogo (al crear, renombrar o borrar una etiqueta). */
export const useRefrescarEtiquetas = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["etiquetas"] }),
    [queryClient],
  );
};
