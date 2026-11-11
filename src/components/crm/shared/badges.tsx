import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  ESTADOS_CLIENTE,
  ETAPAS,
  RESULTADOS,
  TIPOS_ACTIVIDAD,
  nombreDe,
} from "../domain/options";
import type {
  EstadoCliente,
  Etapa,
  Resultado,
  Rol,
  TipoActividad,
} from "../domain/types";

type Tono = "neutro" | "exito" | "aviso" | "peligro" | "info";

const TONOS: Record<Tono, string> = {
  neutro: "border-transparent bg-muted text-muted-foreground",
  exito: "border-transparent bg-success/15 text-success",
  aviso: "border-transparent bg-warning/20 text-warning-foreground",
  peligro: "border-transparent bg-destructive/15 text-destructive",
  info: "border-transparent bg-primary/10 text-primary",
};

export const Pill = ({
  tono = "neutro",
  children,
  className,
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
}) => (
  <Badge variant="outline" className={cn(TONOS[tono], className)}>
    {children}
  </Badge>
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
