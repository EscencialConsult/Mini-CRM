import {
  Briefcase,
  CircleCheckBig,
  CircleX,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { formatMoneda, formatNumero, plural } from "../domain/format";
import type { Modulo } from "../domain/modulos";
import type { PanelIndicadores } from "../domain/types";
import { useModulos } from "../providers/authProvider";
import { useIrAListado } from "../shared/useIrAListado";
import type { RangoFechas } from "./periodos";
import { useIndicadores } from "./usePanel";

interface IndicadorProps {
  /** Módulo sin el cual el indicador no se muestra. */
  modulo: Modulo;
  titulo: string;
  valor: string;
  detalle: string;
  Icono: LucideIcon;
  onAbrir: () => void;
}

const Indicador = ({
  titulo,
  valor,
  detalle,
  Icono,
  onAbrir,
}: IndicadorProps) => (
  <button
    type="button"
    onClick={onAbrir}
    className="flex h-full w-full flex-col gap-1 border-r border-b p-4 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
  >
    <span className="font-subtitulo flex items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {titulo}
      <Icono aria-hidden className="size-4" />
    </span>
    <span className="font-titulo text-3xl font-semibold tracking-tight">
      {valor}
    </span>
    <span className="text-xs text-muted-foreground">{detalle}</span>
  </button>
);

/** Módulos de los que el panel muestra indicadores. */
const MODULOS_CON_INDICADORES: readonly Modulo[] = [
  "clientes",
  "oportunidades",
  "actividades",
];

const Tarjetas = ({ datos }: { datos: PanelIndicadores }) => {
  const irA = useIrAListado();
  const { tiene } = useModulos();
  const indicadores: IndicadorProps[] = [
    {
      modulo: "clientes",
      titulo: "Clientes",
      valor: formatNumero(datos.clientes_total),
      detalle: `${formatNumero(datos.clientes_activos)} activos · ${plural(datos.clientes_nuevos, "nuevo", "nuevos")} en el período`,
      Icono: Users,
      onAbrir: () => irA("clientes", {}, { field: "creado_en", order: "DESC" }),
    },
    {
      modulo: "oportunidades",
      titulo: "Oportunidades abiertas",
      valor: formatNumero(datos.oportunidades_abiertas),
      detalle: `${formatMoneda(datos.importe_abierto)} · ponderado ${formatMoneda(datos.importe_ponderado)}`,
      Icono: Briefcase,
      onAbrir: () =>
        irA(
          "oportunidades",
          { resultado: "abierta" },
          { field: "importe_estimado", order: "DESC" },
        ),
    },
    {
      modulo: "oportunidades",
      titulo: "Ventas ganadas",
      valor: formatMoneda(datos.ganadas_importe),
      detalle: `${plural(datos.ganadas_cantidad, "oportunidad ganada", "oportunidades ganadas")} en el período`,
      Icono: CircleCheckBig,
      onAbrir: () =>
        irA(
          "oportunidades",
          { resultado: "ganada" },
          { field: "fecha_cierre", order: "DESC" },
        ),
    },
    {
      modulo: "oportunidades",
      titulo: "Ventas perdidas",
      valor: formatMoneda(datos.perdidas_importe),
      detalle: `${plural(datos.perdidas_cantidad, "oportunidad perdida", "oportunidades perdidas")} en el período`,
      Icono: CircleX,
      onAbrir: () =>
        irA(
          "oportunidades",
          { resultado: "perdida" },
          { field: "fecha_cierre", order: "DESC" },
        ),
    },
    {
      modulo: "actividades",
      titulo: "Tareas pendientes",
      valor: formatNumero(datos.actividades_pendientes),
      detalle:
        datos.actividades_vencidas > 0
          ? `${plural(datos.actividades_vencidas, "vencida", "vencidas")}`
          : "Ninguna vencida",
      Icono: ListChecks,
      onAbrir: () =>
        irA(
          "actividades",
          { completada: false },
          { field: "fecha", order: "ASC" },
        ),
    },
  ];
  return (
    <>
      {indicadores
        .filter((indicador) => tiene(indicador.modulo))
        .map((indicador) => (
          <Indicador key={indicador.titulo} {...indicador} />
        ))}
    </>
  );
};

/** Indicadores clave del período elegido (una sola consulta agregada). */
export const Indicadores = ({ rango }: { rango: RangoFechas }) => {
  const { data, isPending, error, refetch } = useIndicadores(rango);
  const { tiene } = useModulos();

  if (!MODULOS_CON_INDICADORES.some(tiene)) return null;

  return (
    <section
      aria-label="Indicadores"
      className="overflow-hidden rounded-lg border bg-card"
    >
      <div className="-mr-px -mb-px grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
        {isPending ? (
          Array.from({ length: 5 }, (_, indice) => (
            <div
              key={indice}
              className="space-y-2 border-r border-b p-4"
              aria-busy="true"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))
        ) : error || !data ? (
          <p
            role="alert"
            className="col-span-full border-r border-b p-5 text-sm text-destructive"
          >
            No se pudieron cargar los indicadores.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </p>
        ) : (
          <Tarjetas datos={data} />
        )}
      </div>
    </section>
  );
};
