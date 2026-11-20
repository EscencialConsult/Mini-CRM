import { MessageCircle } from "lucide-react";
import { useNotify, useRecordContext } from "ra-core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { generarClave } from "../domain/claves";
import type { Cuenta } from "../domain/types";
import { enlaceWhatsapp } from "../domain/whatsapp";
import { useCrmDataProvider } from "../providers/dataProvider";
import {
  accesosPendientes,
  mensajeAcceso,
  publicarAcceso,
  suscribirAcceso,
  type CredencialesCuenta,
} from "./acceso";
import { CopiarBoton } from "./CopiarBoton";
import { buscarTelefono } from "./telefonos";

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

const Dato = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-mono text-sm break-all">{valor}</p>
    </div>
    <CopiarBoton texto={valor} />
  </div>
);

/** Acceso listo para mandar: datos para copiar, el mensaje y el botón de WhatsApp. */
const PanelAcceso = ({
  credenciales,
  recien,
}: {
  credenciales: CredencialesCuenta;
  recien: boolean;
}) => {
  const [telefono, setTelefono] = useState(credenciales.telefono);
  const [mensaje, setMensaje] = useState(() => mensajeAcceso(credenciales));
  const enlace = enlaceWhatsapp(telefono, mensaje);
  const host = window.location.hostname;
  const entornoDePrueba =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    ["trycloudflare", "ngrok", "loca.lt"].some((marca) => host.includes(marca));

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {recien
          ? "Cuenta creada. Mandale el acceso al titular:"
          : "Contraseña nueva lista. Mandale el acceso al titular:"}
      </p>
      <div className="space-y-2">
        <Dato rotulo="Dirección" valor={window.location.origin} />
        <Dato rotulo="Usuario" valor={credenciales.email} />
        <Dato rotulo="Contraseña" valor={credenciales.password} />
        <p className="text-sm text-muted-foreground">
          La contraseña solo se ve acá y ahora. Si se pierde, generás otra desde
          esta misma pantalla.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="acceso-whatsapp">
          WhatsApp del titular
        </label>
        <Input
          id="acceso-whatsapp"
          type="tel"
          value={telefono}
          onChange={(evento) => setTelefono(evento.target.value)}
          placeholder="+54 9 11 5555 1234"
        />
        {entornoDePrueba && (
          <p
            role="note"
            className="rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning-foreground"
          >
            Estás en un entorno de prueba ({host}): la dirección que va en el
            mensaje no es la de producción. Corregila en el mensaje antes de
            enviarlo.
          </p>
        )}
        <label className="text-sm font-medium" htmlFor="acceso-mensaje">
          Mensaje
        </label>
        <Textarea
          id="acceso-mensaje"
          value={mensaje}
          onChange={(evento) => setMensaje(evento.target.value)}
          rows={8}
        />
        <div className="flex flex-wrap gap-2">
          {enlace ? (
            <Button asChild>
              <a href={enlace} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                Enviar por WhatsApp
              </a>
            </Button>
          ) : (
            <Button type="button" disabled>
              <MessageCircle />
              Enviar por WhatsApp
            </Button>
          )}
          <CopiarBoton texto={mensaje} etiqueta="Copiar mensaje" />
        </div>
        {!enlace && (
          <p className="text-sm text-muted-foreground">
            Escribí el número con el código de país para abrir el chat.
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Acceso del titular, dentro de la ficha de la cuenta: recién creada, muestra
 * el acceso listo para mandar; en cualquier momento, «Preparar» genera una
 * contraseña nueva y arma el mensaje (la anterior deja de funcionar).
 */
export const AccesoTitular = () => {
  const cuenta = useRecordContext<Cuenta>();
  const dataProvider = useCrmDataProvider();
  const notify = useNotify();
  const [credenciales, setCredenciales] = useState<CredencialesCuenta | null>(
    () => (cuenta ? (accesosPendientes.get(cuenta.id) ?? null) : null),
  );
  const [enCurso, setEnCurso] = useState(false);
  const cuentaId = cuenta?.id;

  // Un acceso nuevo (de acá o de «Contraseña del titular») reemplaza al mostrado
  useEffect(() => {
    if (cuentaId === undefined) return;
    return suscribirAcceso(cuentaId, setCredenciales);
  }, [cuentaId]);

  // La contraseña no se conserva: al cerrar la ficha se descarta
  useEffect(
    () => () => {
      if (cuentaId !== undefined) accesosPendientes.delete(cuentaId);
    },
    [cuentaId],
  );

  if (!cuenta?.titular) return null;
  const titular = cuenta.titular;

  const preparar = async () => {
    setEnCurso(true);
    try {
      const password = generarClave();
      await dataProvider.restablecerClaveTitular(
        cuenta.id,
        titular.id,
        password,
      );
      publicarAcceso(cuenta.id, {
        titular: titular.nombre,
        email: titular.email,
        password,
        telefono: await buscarTelefono(titular.email),
        origen: "cambio",
      });
    } catch (error) {
      notify(mensajeDe(error), { type: "error" });
    } finally {
      setEnCurso(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Enviar el acceso por WhatsApp</p>
      {credenciales ? (
        <PanelAcceso
          key={credenciales.password}
          credenciales={credenciales}
          recien={credenciales.origen === "alta"}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {titular.nombre} {titular.apellido} · {titular.email}. Se genera una
            contraseña nueva, se guarda y se arma el mensaje con el usuario y la
            contraseña. La anterior deja de funcionar.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={enCurso}
            onClick={() => void preparar()}
          >
            <MessageCircle />
            {enCurso ? "Preparando…" : "Preparar mensaje de acceso"}
          </Button>
        </>
      )}
    </div>
  );
};
