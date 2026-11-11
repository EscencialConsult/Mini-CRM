import { useCallback } from "react";
import { matchPath, useLocation, useNavigate } from "react-router";

export type RecordRoute =
  { mode: "list" } | { mode: "create" } | { mode: "edit"; id: string };

/**
 * Qué muestra la URL de un recurso: el listado solo, o el listado con el
 * modal de alta (`/recurso/create`) o de detalle (`/recurso/:id`).
 */
export const useRecordRoute = (resource: string): RecordRoute => {
  const { pathname } = useLocation();
  const segment = matchPath({ path: `/${resource}/:segment/*` }, pathname)
    ?.params.segment;
  if (!segment) return { mode: "list" };
  if (segment === "create") return { mode: "create" };
  return { mode: "edit", id: decodeURIComponent(segment) };
};

/**
 * Cierra el modal: vuelve a la pantalla anterior si se llegó navegando dentro
 * de la app, o al listado si se entró directo por la URL.
 */
export const useCloseRecord = (resource: string) => {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    if (key !== "default") navigate(-1);
    else navigate(`/${resource}`, { replace: true });
  }, [key, navigate, resource]);
};

/** Navegación entre registros: reemplaza la entrada para no apilar historial. */
export const useOpenRecord = (resource: string) => {
  const navigate = useNavigate();
  return useCallback(
    (id: string | number, replace = false) =>
      navigate(`/${resource}/${encodeURIComponent(String(id))}`, { replace }),
    [navigate, resource],
  );
};
