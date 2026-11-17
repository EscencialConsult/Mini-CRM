import { MessageCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha } from "../domain/format";
import { enlaceWhatsapp } from "../domain/whatsapp";
import { Pill } from "../shared/badges";
import { rutaAltaDesde, type Solicitud } from "./useSolicitudes";

const saludo = (solicitud: Solicitud) =>
  `Hola ${solicitud.nombre}, soy de Dealflow. Recibimos tu solicitud de prueba${
    solicitud.empresa ? ` para ${solicitud.empresa}` : ""
  }. ¿Hablamos un minuto para dejarla lista?`;

/** «Descartar» pide una confirmación en la misma fila, sin ventana aparte. */
const Descartar = ({ alConfirmar }: { alConfirmar: () => Promise<void> }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [enCurso, setEnCurso] = useState(false);

  if (!confirmando) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirmando(true)}
      >
        Descartar
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1" role="group">
      <span className="text-sm text-muted-foreground">
        ¿Sacarla de pendientes?
      </span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={enCurso}
        onClick={() => {
          setEnCurso(true);
          void alConfirmar().finally(() => {
            setEnCurso(false);
            setConfirmando(false);
          });
        }}
      >
        Sí, descartar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={enCurso}
        onClick={() => setConfirmando(false)}
      >
        No
      </Button>
    </span>
  );
};

/**
 * Empresas que pidieron la prueba desde la landing y esperan su cuenta. Por
 * cada una: hablarle por WhatsApp antes de activar, darla de alta con todo
 * cargado, o descartarla (repetida, falsa…): el cliente queda en Clientes.
 */
export const SolicitudesPendientes = ({
  solicitudes,
  alDescartar,
}: {
  solicitudes: Solicitud[];
  alDescartar: (solicitud: Solicitud) => Promise<void>;
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
            solicitud.email,
            formatFecha(solicitud.creadoEn),
          ]
            .filter(Boolean)
            .join(" · ");
          const whatsapp = enlaceWhatsapp(
            solicitud.telefono,
            saludo(solicitud),
          );
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
              <div className="flex flex-wrap items-center gap-2">
                <Descartar alConfirmar={() => alDescartar(solicitud)} />
                {whatsapp && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle />
                      WhatsApp
                    </a>
                  </Button>
                )}
                <Button asChild size="sm">
                  <Link to={rutaAltaDesde(solicitud.clienteId)}>
                    <UserPlus />
                    Dar de alta
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
