import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { enlaceWhatsapp } from "../domain/whatsapp";
import { RecordDialog } from "../shared/RecordDialog";
import { CopiarBoton } from "./CopiarBoton";

/** Lo que se le entrega al titular de una cuenta recién creada. */
export interface CredencialesCuenta {
  cuenta: string;
  titular: string;
  email: string;
  password: string;
  /** Con el que se arma el enlace de WhatsApp; se puede corregir acá. */
  telefono: string;
}

const mensajeAcceso = ({ titular, email, password }: CredencialesCuenta) =>
  [
    `Hola ${titular}, te paso el acceso a tu prueba de Dealflow:`,
    "",
    window.location.origin,
    `Usuario: ${email}`,
    `Contraseña: ${password}`,
    "",
    "Ya podés entrar. Si querés cambiar la contraseña o tenés alguna duda, escribime por acá.",
  ].join("\n");

const Dato = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-mono text-sm break-all">{valor}</p>
    </div>
    <CopiarBoton texto={valor} />
  </div>
);

/**
 * Se muestra al crear una cuenta: la contraseña no se vuelve a ver (si se
 * pierde, se restablece desde la cuenta), así que acá se copia o se manda.
 */
export const CredencialesCuentaDialog = ({
  credenciales,
  onClose,
}: {
  credenciales: CredencialesCuenta;
  onClose: () => void;
}) => {
  const [telefono, setTelefono] = useState(credenciales.telefono);
  const [mensaje, setMensaje] = useState(() => mensajeAcceso(credenciales));
  const enlace = enlaceWhatsapp(telefono, mensaje);

  return (
    <RecordDialog
      title="Cuenta creada"
      description={credenciales.cuenta}
      size="md"
      onClose={onClose}
    >
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <Dato rotulo="Dirección" valor={window.location.origin} />
          <Dato rotulo="Usuario" valor={credenciales.email} />
          <Dato rotulo="Contraseña" valor={credenciales.password} />
          <p className="text-sm text-muted-foreground">
            La contraseña solo se ve ahora. Si se pierde, se restablece desde la
            cuenta.
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
            <Button asChild={!!enlace} disabled={!enlace}>
              {enlace ? (
                <a href={enlace} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  Enviar por WhatsApp
                </a>
              ) : (
                <span>
                  <MessageCircle />
                  Enviar por WhatsApp
                </span>
              )}
            </Button>
            <CopiarBoton texto={mensaje} etiqueta="Copiar mensaje" />
          </div>
          {!enlace && (
            <p className="text-sm text-muted-foreground">
              Escribí el número con el código de país para abrir el chat.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </RecordDialog>
  );
};
