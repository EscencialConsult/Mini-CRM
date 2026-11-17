import { UserPlus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha } from "../domain/format";
import { Pill } from "../shared/badges";
import { rutaAltaDesde, type Solicitud } from "./useSolicitudes";

/**
 * Empresas que pidieron la prueba desde la landing y esperan su cuenta: un clic
 * en «Dar de alta» abre el alta con todo cargado.
 */
export const SolicitudesPendientes = ({
  solicitudes,
}: {
  solicitudes: Solicitud[];
}) => {
  if (solicitudes.length === 0) return null;
  return (
    <section
      aria-label="Solicitudes de prueba pendientes"
      className="rounded-lg border bg-card"
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-base font-semibold">Solicitudes de prueba</h2>
        <Pill tono="aviso">{solicitudes.length} pendientes</Pill>
      </header>
      <ul className="divide-y">
        {solicitudes.map((solicitud) => {
          const persona = `${solicitud.nombre} ${solicitud.apellido}`.trim();
          const contacto = [
            solicitud.empresa ? persona : "",
            solicitud.telefono,
            formatFecha(solicitud.creadoEn),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={solicitud.clienteId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {solicitud.empresa || persona}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {contacto}
                </p>
              </div>
              <Button asChild size="sm">
                <Link to={rutaAltaDesde(solicitud.clienteId)}>
                  <UserPlus />
                  Dar de alta
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
