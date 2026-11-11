import { useStoreContext, type SortPayload } from "ra-core";
import { useCallback } from "react";
import { useNavigate } from "react-router";

/**
 * Abre un listado ya filtrado (desde el panel o la campana de recordatorios).
 * Los filtros viven en el store del navegador, no en la URL, así que se
 * escriben ahí antes de navegar.
 */
export const useIrAListado = () => {
  const store = useStoreContext();
  const navigate = useNavigate();

  return useCallback(
    (
      resource: string,
      filter: Record<string, unknown>,
      sort: SortPayload,
      perPage = 25,
    ) => {
      store.setItem(`${resource}.listParams`, {
        filter,
        sort: sort.field,
        order: sort.order,
        page: 1,
        perPage,
        displayedFilters: {},
      });
      navigate(`/${resource}`);
    },
    [store, navigate],
  );
};
