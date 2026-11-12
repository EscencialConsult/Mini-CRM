import { useQueryClient } from "@tanstack/react-query";
import { useGetList } from "ra-core";
import { useCallback, useMemo } from "react";

import type { Producto } from "../domain/types";

const CINCO_MINUTOS = 5 * 60 * 1000;

/**
 * Catálogo de productos para el selector de líneas: se pide una vez y lo
 * comparten todas las pantallas. Trae también los inactivos: no se ofrecen,
 * pero una oportunidad vieja puede tenerlos.
 */
export const useProductos = () => {
  const { data, isPending, error } = useGetList<Producto>(
    "productos",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "nombre", order: "ASC" },
      meta: { columns: ["id", "nombre", "descripcion", "precio", "activo"] },
    },
    { staleTime: CINCO_MINUTOS },
  );

  return useMemo(() => {
    const productos = data ?? [];
    return {
      isPending,
      hayError: !!error,
      productos,
      activos: productos.filter((producto) => producto.activo),
      porId: new Map(productos.map((producto) => [producto.id, producto])),
    };
  }, [data, isPending, error]);
};

/** Vuelve a pedir el catálogo (al crear, editar, desactivar o borrar). */
export const useRefrescarProductos = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["productos"] }),
    [queryClient],
  );
};
