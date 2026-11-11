import { Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  enlaceTelefono,
  enlaceWhatsApp,
  formatFecha,
  hoyIso,
  iniciales,
} from "../domain/format";
import type { Cliente } from "../domain/types";
import { EtiquetasCliente } from "../etiquetas/EtiquetaChip";

/** Iniciales del cliente. */
export const ClienteAvatar = ({ cliente }: { cliente: Cliente }) => (
  <Avatar className="size-11 shrink-0 text-base font-semibold">
    <AvatarFallback>{iniciales(cliente.nombre_completo)}</AvatarFallback>
  </Avatar>
);

const Dato = ({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
    <dd className="truncate font-medium">{children}</dd>
  </div>
);

const ProximoContacto = ({ cliente }: { cliente: Cliente }) => {
  if (!cliente.proximo_contacto) {
    return <span className="font-normal text-muted-foreground">Sin fecha</span>;
  }
  const vencido =
    cliente.estado === "activo" && cliente.proximo_contacto < hoyIso();
  return (
    <span className={cn(vencido && "text-destructive")}>
      {formatFecha(cliente.proximo_contacto)}
      {vencido && " · vencido"}
    </span>
  );
};

/**
 * Cabecera de la ficha: vendedor, próximo contacto y etiquetas (lo guardado,
 * no lo que se esté editando), y accesos para llamar, escribir por WhatsApp
 * o mandar un email.
 */
export const ClienteResumen = ({ cliente }: { cliente: Cliente }) => {
  const telefono = enlaceTelefono(cliente.telefono);
  const whatsapp = enlaceWhatsApp(cliente.telefono);
  const contactos = (
    <>
      {telefono && (
        <Button asChild variant="outline" size="sm">
          <a href={telefono}>
            <Phone aria-hidden />
            Llamar
          </a>
        </Button>
      )}
      {whatsapp && (
        <Button asChild variant="outline" size="sm">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden className="text-whatsapp" />
            WhatsApp
          </a>
        </Button>
      )}
      {cliente.email && (
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${cliente.email}`}>
            <Mail aria-hidden />
            Email
          </a>
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Dato etiqueta="Vendedor">
            {cliente.asignado_nombre ?? (
              <span className="font-normal text-muted-foreground">
                Sin asignar
              </span>
            )}
          </Dato>
          <Dato etiqueta="Próximo contacto">
            <ProximoContacto cliente={cliente} />
          </Dato>
        </dl>
        <EtiquetasCliente ids={cliente.etiquetas} />
      </div>
      {(telefono || whatsapp || cliente.email) && (
        <div className="flex flex-wrap gap-2 sm:justify-end">{contactos}</div>
      )}
    </div>
  );
};
