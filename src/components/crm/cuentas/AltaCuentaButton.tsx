import { UserPlus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { useEsPlataforma } from "../providers/authProvider";
import { rutaAltaDesde, useEsSolicitudPendiente } from "./useSolicitudes";

/**
 * En la ficha de un cliente que pidió la prueba (etiqueta «Solicitó prueba»):
 * el alta de su cuenta a un clic. Solo lo ve la plataforma.
 */
export const AltaCuentaButton = ({
  clienteId,
  etiquetas,
}: {
  clienteId: number;
  etiquetas: number[] | undefined;
}) => {
  const esPlataforma = useEsPlataforma();
  const pendiente = useEsSolicitudPendiente(etiquetas, esPlataforma);
  if (!esPlataforma || !pendiente) return null;
  return (
    <Button asChild size="sm">
      <Link to={rutaAltaDesde(clienteId)}>
        <UserPlus />
        Dar de alta su cuenta
      </Link>
    </Button>
  );
};
