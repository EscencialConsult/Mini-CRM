import { useGetList } from "ra-core";
import { useMemo } from "react";

import type { Usuario } from "../domain/types";

const CINCO_MINUTOS = 5 * 60 * 1000;

export interface OpcionUsuario {
  id: string;
  name: string;
}

const nombreCompleto = (usuario: Usuario): string =>
  `${usuario.nombre} ${usuario.apellido}`.trim();

/**
 * Usuarios del CRM para desplegables de asignación y filtros (se piden una vez y se reutilizan).
 * El usuario del sistema ("Bot WhatsApp") no se ofrece para asignar, pero queda en
 * `usuarios` y en `opcionesTodas`: así su nombre se ve como responsable de las ventas
 * de pedidos y se puede filtrar por él.
 */
export const useUsuarios = () => {
  const { data, isPending } = useGetList<Usuario>(
    "usuarios",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "nombre", order: "ASC" },
    },
    { staleTime: CINCO_MINUTOS },
  );

  return useMemo(() => {
    const usuarios = data ?? [];
    return {
      isPending,
      usuarios,
      /** Solo activos y de personas (no del sistema): para asignar. */
      opcionesActivas: usuarios
        .filter((usuario) => usuario.activo && !usuario.sistema)
        .map((usuario): OpcionUsuario => ({
          id: usuario.id,
          name: nombreCompleto(usuario),
        })),
      /** Todos, con los inactivos marcados: para filtrar registros históricos. */
      opcionesTodas: usuarios.map((usuario): OpcionUsuario => ({
        id: usuario.id,
        name: usuario.activo
          ? nombreCompleto(usuario)
          : `${nombreCompleto(usuario)} (inactivo)`,
      })),
    };
  }, [data, isPending]);
};
