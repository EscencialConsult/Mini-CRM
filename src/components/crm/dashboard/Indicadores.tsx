import {
  Briefcase,
  CircleCheckBig,
  CircleX,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { formatMoneda, formatNumero, plural } from "../domain/format";
import type { PanelIndicadores } from "../domain/types";
import { useIrAListado } from "../shared/useIrAListado";
import type { RangoFechas } from "./periodos";
import { useIndicadores } from "./usePanel";

interface IndicadorProps {
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
  <Card className="py-0">
    <button
      type="button"
      onClick={onAbrir}
      className="flex h-full w-full flex-col gap-1 rounded-xl p-5 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between text-sm text-muted-foreground">
        {titulo}
        <Icono aria-hidden className="size-4" />
      </span>
      <span className="text-2xl font-semibold tracking-tight">{valor}</span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </button>
  </Card>
);

const Tarjetas = ({ datos }: { datos: PanelIndicadores }) => {
  const irA = useIrAListado();
  return (
    <>
      <Indicador
        titulo="Clientes"
        valor={formatNumero(datos.clientes_total)}
        detalle={`${formatNumero(datos.clientes_activos)} activos · ${plural(datos.clientes_nuevos, "nuevo", "nuevos")} en el período`}
        Icono={Users}
        onAbrir={() =>
          irA("clientes", {}, { field: "creado_en", order: "DESC" })
        }
      />
      <Indicador
        titulo="Oportunidades abiertas"
        valor={formatNumero(datos.oportunidades_abiertas)}
        detalle={`${formatMoneda(datos.importe_abierto)} · ponderado ${formatMoneda(datos.importe_ponderado)}`}
        Icono={Briefcase}
        onAbrir={() =>
          irA(
            "oportunidades",
            { resultado: "abierta" },
            { field: "importe_estimado", order: "DESC" },
          )
        }
      />
      <Indicador
        titulo="Ventas ganadas"
        valor={formatMoneda(datos.ganadas_importe)}
        detalle={`${plural(datos.ganadas_cantidad, "oportunidad ganada", "oportunidades ganadas")} en el período`}
        Icono={CircleCheckBig}
        onAbrir={() =>
          irA(
            "oportunidades",
            { resultado: "ganada" },
            { field: "fecha_cierre", order: "DESC" },
          )
        }
      />
      <Indicador
        titulo="Ventas perdidas"
        valor={formatMoneda(datos.perdidas_importe)}
        detalle={`${plural(datos.perdidas_cantidad, "oportunidad perdida", "oportunidades perdidas")} en el período`}
        Icono={CircleX}
        onAbrir={() =>
          irA(
            "oportunidades",
            { resultado: "perdida" },
            { field: "fecha_cierre", order: "DESC" },
          )
        }
      />
      <Indicador
        titulo="Tareas pendientes"
        valor={formatNumero(datos.actividades_pendientes)}
        detalle={
          datos.actividades_vencidas > 0
            ? `${plural(datos.actividades_vencidas, "vencida", "vencidas")}`
            : "Ninguna vencida"
        }
        Icono={ListChecks}
        onAbrir={() =>
          irA(
            "actividades",
            { completada: false },
            { field: "fecha", order: "ASC" },
          )
        }
      />
    </>
  );
};

/** Indicadores clave del período elegido (una sola consulta agregada). */
export const Indicadores = ({ rango }: { rango: RangoFechas }) => {
  const { data, isPending, error, refetch } = useIndicadores(rango);

  return (
    <section
      aria-label="Indicadores"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {isPending ? (
        Array.from({ length: 5 }, (_, indice) => (
          <Card key={indice} className="py-0">
            <CardContent className="space-y-2 p-5" aria-busy="true">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))
      ) : error || !data ? (
        <p role="alert" className="col-span-full text-sm text-destructive">
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
    </section>
  );
};
