import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  ESTADOS_CLIENTE,
  ESTADOS_PEDIDO,
  ETAPAS,
  RESULTADOS,
  TIPOS_ACTIVIDAD,
  nombreDe,
} from "../domain/options";
import type {
  EstadoCliente,
  EstadoPedido,
  Etapa,
  Resultado,
  Rol,
  TipoActividad,
} from "../domain/types";

type Tono = "neutro" | "exito" | "aviso" | "peligro" | "info";

const TONOS: Record<Tono, string> = {
  neutro: "text-muted-foreground",
  exito: "text-success",
  aviso: "text-warning-foreground",
  peligro: "text-destructive",
  info: "text-primary",
};

/** Estado: un punto de color y el texto, sin fondo (más sobrio en una tabla larga). */
export const Pill = ({
  tono = "neutro",
  children,
  className,
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
      TONOS[tono],
      className,
    )}
  >
    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
    {children}
  </span>
);

export const EstadoClienteBadge = ({ estado }: { estado: EstadoCliente }) => (
  <Pill tono={estado === "activo" ? "exito" : "neutro"}>
    {nombreDe(ESTADOS_CLIENTE, estado)}
  </Pill>
);

const TONO_RESULTADO: Record<Resultado, Tono> = {
  abierta: "info",
  ganada: "exito",
  perdida: "peligro",
};

export const ResultadoBadge = ({ resultado }: { resultado: Resultado }) => (
  <Pill tono={TONO_RESULTADO[resultado]}>
    {nombreDe(RESULTADOS, resultado)}
  </Pill>
);

const TONO_PEDIDO: Record<EstadoPedido, Tono> = {
  nuevo: "info",
  en_preparacion: "aviso",
  en_camino: "aviso",
  listo_para_retirar: "aviso",
  entregado: "exito",
  cancelado: "peligro",
};

export const EstadoPedidoBadge = ({ estado }: { estado: EstadoPedido }) => (
  <Pill tono={TONO_PEDIDO[estado]}>{nombreDe(ESTADOS_PEDIDO, estado)}</Pill>
);

export const EtapaBadge = ({ etapa }: { etapa: Etapa }) => (
  <Pill tono="neutro">{nombreDe(ETAPAS, etapa)}</Pill>
);

export const RolBadge = ({ rol }: { rol: Rol }) => (
  <Pill tono={rol === "administrador" ? "info" : "neutro"}>
    {rol === "administrador" ? "Administrador" : "Vendedor"}
  </Pill>
);

export const TipoActividadLabel = ({ tipo }: { tipo: TipoActividad }) => (
  <span>{nombreDe(TIPOS_ACTIVIDAD, tipo)}</span>
);
