import { useQueryClient } from "@tanstack/react-query";
import { useGetList } from "ra-core";
import { useCallback, useMemo } from "react";

import type { Canal } from "../domain/types";

const CINCO_MINUTOS = 5 * 60 * 1000;

export interface OpcionCanal {
  id: number;
  name: string;
}

/**
 * Catálogo de canales de venta (los ve cualquiera; los administra el
 * administrador): selectores, filtros y la auditoría.
 */
export const useCanales = () => {
  const { data, isPending } = useGetList<Canal>(
    "canales",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "nombre", order: "ASC" },
      meta: { columns: ["id", "nombre", "clave", "activo"] },
    },
    { staleTime: CINCO_MINUTOS },
  );

  return useMemo(() => {
    const canales = data ?? [];
    const aOpcion = (canal: Canal): OpcionCanal => ({
      id: canal.id,
      name: canal.activo ? canal.nombre : `${canal.nombre} (inactivo)`,
    });
    return {
      isPending,
      canales,
      porId: new Map(canales.map((canal) => [canal.id, canal])),
      /** Para filtrar listados: todos, también los inactivos (id en texto). */
      opcionesFiltro: canales.map((canal) => ({
        id: String(canal.id),
        name: canal.nombre,
      })),
      /** Para elegir: los activos más el que ya tenga el registro. */
      opcionesPara: (actual: number | null | undefined) =>
        canales
          .filter((canal) => canal.activo || canal.id === actual)
          .map(aOpcion),
    };
  }, [data, isPending]);
};

/** Vuelve a pedir el catálogo (al crear, renombrar o borrar un canal). */
export const useRefrescarCanales = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["canales"] }),
    [queryClient],
  );
};
