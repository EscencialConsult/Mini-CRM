import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Datos que dependen entre sí (contadores de la ficha del cliente, panel,
// recordatorios, uso de productos y canales): se invalidan juntos y solo se
// vuelven a pedir los que están en pantalla.
const CLAVES_DERIVADAS = [
  "clientes",
  "oportunidades",
  "pedidos",
  "pedido_historial",
  "actividades",
  "productos",
  "canales",
  "ventas",
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
