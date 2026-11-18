import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { useGetList } from "ra-core";
import { useEffect } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { diasDesdeQueTermino } from "../domain/prueba";
import { plural } from "../domain/format";
import type { Cuenta } from "../domain/types";
import { enlaceWhatsapp } from "../domain/whatsapp";
import { Pill } from "../shared/badges";
import { useAhora } from "../shared/useAhora";
import { mensajeSeguimientoPrueba } from "./seguimientoPrueba";
import { buscarTelefonos } from "./telefonos";

/** Pasado este tiempo ya no tiene sentido preguntarle si le interesó. */
const DIAS_DE_SEGUIMIENTO = 14;

const cuandoTermino = (dias: number) => {
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${plural(dias, "día", "días")}`;
};

/**
 * Cuentas cuya prueba gratis terminó hace poco, con el WhatsApp armado para
 * preguntarle al titular si le interesó seguir. Es un extra: sin cuentas por
 * seguir no muestra nada, y si falla la lectura avisa con una línea discreta.
 */
export const PruebasTerminadas = () => {
  const ahora = useAhora();
  const { data, isPending, error } = useGetList<Cuenta>("cuentas", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "nombre", order: "ASC" },
    filter: { estado: "prueba_terminada" },
  });

  useEffect(() => {
    if (error)
      console.error("No se pudieron leer las pruebas terminadas", error);
  }, [error]);

  const filas = (data ?? [])
    .map((cuenta) => ({ cuenta, dias: diasDesdeQueTermino(cuenta, ahora) }))
    .filter(
      (fila): fila is { cuenta: Cuenta; dias: number } =>
        fila.dias !== null && fila.dias <= DIAS_DE_SEGUIMIENTO,
    )
    .sort((a, b) => a.dias - b.dias);

  const emails = filas.flatMap(({ cuenta }) =>
    cuenta.titular?.email ? [cuenta.titular.email] : [],
  );

  const { data: telefonos } = useQuery({
    queryKey: ["pruebas-terminadas", "telefonos", emails.join(",")],
    queryFn: () => buscarTelefonos(emails),
    enabled: emails.length > 0,
  });

  if (error) {
    return (
      <section
        aria-label="Pruebas terminadas"
        className="rounded-lg border bg-card"
      >
        <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
          No se pudieron leer las pruebas terminadas. Recargá la página para
          volver a intentarlo.
        </p>
      </section>
    );
  }

  if (isPending || filas.length === 0) return null;

  return (
    <section
      aria-label="Pruebas terminadas"
      className="rounded-lg border bg-card"
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-3">
        <h2 className="text-base font-semibold">Pruebas terminadas</h2>
        <Pill tono="aviso">{filas.length} para seguir</Pill>
      </header>
      <ul className="divide-y">
        {filas.map(({ cuenta, dias }) => {
          const titular = cuenta.titular;
          const persona = titular
            ? `${titular.nombre} ${titular.apellido}`.trim()
            : "Sin titular";
          const detalle = [
            persona,
            titular?.email,
            `terminó ${cuandoTermino(dias)}`,
          ]
            .filter(Boolean)
            .join(" · ");
          const telefono = titular
            ? telefonos?.get(titular.email.trim().toLowerCase())
            : undefined;
          const whatsapp =
            titular && telefono
              ? enlaceWhatsapp(
                  telefono,
                  mensajeSeguimientoPrueba({
                    nombre: titular.nombre,
                    empresa: cuenta.nombre,
                  }),
                )
              : "";
          const motivoId = `motivo-sin-whatsapp-${cuenta.id}`;
          const motivo = !titular
            ? "Sin titular: abrí la cuenta para ver qué pasó."
            : "Sin teléfono: abrí la cuenta para cargarlo.";
          return (
            <li key={cuenta.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium break-words">{cuenta.nombre}</p>
                  <p className="min-w-0 text-sm break-words text-muted-foreground">
                    {detalle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {whatsapp ? (
                    <Button asChild variant="outline" className="min-h-10">
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle />
                        ¿Le interesó?
                      </a>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10"
                      disabled
                      aria-describedby={motivoId}
                    >
                      <MessageCircle />
                      ¿Le interesó?
                    </Button>
                  )}
                  <Button asChild className="min-h-10">
                    <Link to={`/cuentas/${cuenta.id}`}>Abrir cuenta</Link>
                  </Button>
                </div>
              </div>
              {!whatsapp && (
                <p id={motivoId} className="mt-2 text-xs text-muted-foreground">
                  {motivo}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
