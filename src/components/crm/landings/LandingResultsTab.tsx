import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useDataProvider, useTranslate } from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  formatFecha,
  formatFechaHora,
  formatMoneda,
  formatNumero,
  formatPorcentaje,
} from "../domain/format";
import type { Landing, LandingEstadisticas } from "../domain/types";
import { useModulos } from "../providers/authProvider";
import type { CrmDataProvider } from "../providers/dataProvider";
import { landingLeadsPath } from "./landingUrls";

const PERIODS = [7, 30, 90];

const Tile = ({
  label,
  value,
  detail,
  isLong,
}: {
  label: string;
  value: string;
  detail?: string;
  /** A date, not a figure: smaller, and it may take two lines */
  isLong?: boolean;
}) => (
  <div className="min-w-0 rounded-lg border bg-card p-3">
    <p className="truncate text-xs text-muted-foreground">{label}</p>
    <p
      className={cn(
        "mt-1 font-semibold tabular-nums",
        isLong ? "text-base leading-snug" : "truncate text-2xl",
      )}
    >
      {value}
    </p>
    {detail && (
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
    )}
  </div>
);

/**
 * One measure per day, read as bars from a shared baseline. Visits and
 * submissions have very different scales: each one gets its own chart.
 */
const DailyBars = ({
  title,
  rows,
  measure,
}: {
  title: string;
  rows: LandingEstadisticas["por_dia"];
  measure: "visitas" | "envios";
}) => {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((row) => row[measure]));
  const hovered = active == null ? null : rows[active];
  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="relative mt-5 h-28">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="absolute -top-4 right-0 text-xs tabular-nums text-muted-foreground">
          {formatNumero(max)}
        </span>
        <div
          className="absolute inset-0 flex items-end gap-0.5 border-b border-border"
          onMouseLeave={() => setActive(null)}
        >
          {rows.map((row, index) => (
            <div
              key={row.dia}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
              onMouseEnter={() => setActive(index)}
            >
              <div
                className={cn(
                  "w-full max-w-5 rounded-t-[4px] bg-primary transition-opacity",
                  active != null && active !== index && "opacity-40",
                )}
                style={{ height: `${(row[measure] / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        {hovered && active != null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
            style={{
              left: `${Math.min(88, Math.max(12, ((active + 0.5) / rows.length) * 100))}%`,
            }}
          >
            <span className="text-muted-foreground">
              {formatFecha(hovered.dia)}:
            </span>{" "}
            <span className="font-medium tabular-nums">
              {formatNumero(hovered[measure])}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{formatFecha(rows[0]?.dia)}</span>
        <span>{formatFecha(rows[rows.length - 1]?.dia)}</span>
      </div>
    </figure>
  );
};

const Breakdown = ({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[];
  empty: string;
}) => {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="min-w-0 rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="font-medium tabular-nums">{row.value}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted">
                <div
                  className="h-1 rounded-full bg-primary"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const LandingResultsTab = ({ landing }: { landing: Landing }) => {
  const translate = useTranslate();
  // Sin el módulo Clientes el nombre no lleva a la ficha (no podría abrirla)
  const conClientes = useModulos().tiene("clientes");
  const t = (key: string, options?: object) =>
    translate(`resources.landings.editor.results.${key}`, options);
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [days, setDays] = useState(30);
  const {
    data: stats,
    isPending,
    error,
  } = useQuery({
    queryKey: ["landing_estadisticas", landing.id, days],
    queryFn: () => dataProvider.estadisticasLanding(landing.id, days),
    retry: false,
  });

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex rounded-md border p-0.5">
        {PERIODS.map((period) => (
          <Button
            key={period}
            type="button"
            size="sm"
            variant={period === days ? "secondary" : "ghost"}
            aria-pressed={period === days}
            onClick={() => setDays(period)}
          >
            {t("last_days", { smart_count: period })}
          </Button>
        ))}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to={landingLeadsPath(landing.id)}>
          {t("see_leads")}
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {header}
        <p role="alert" className="text-sm text-destructive">
          {translate("crm.common.load_error")}
        </p>
      </div>
    );
  }
  if (isPending || !stats) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {header}
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const namedRows = (rows: LandingEstadisticas["fuentes"]) =>
    rows.map((row) => ({
      key: row.etiqueta || "directo",
      label: row.etiqueta || t("no_campaign_data"),
      value: row.envios,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {header}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Tile label={t("visits")} value={formatNumero(stats.visitas)} />
        <Tile label={t("leads")} value={formatNumero(stats.envios)} />
        <Tile
          label={t("new_clients")}
          value={formatNumero(stats.clientes_nuevos)}
          detail={t("new_clients_detail")}
        />
        <Tile
          label={t("conversion")}
          value={
            stats.visitas ? formatPorcentaje(stats.envios / stats.visitas) : "–"
          }
          detail={t("conversion_detail")}
        />
        <Tile
          label={t("sales")}
          value={formatNumero(stats.ventas)}
          detail={
            stats.ventas
              ? formatMoneda(stats.importe_ganado)
              : t("sales_detail")
          }
        />
        <Tile
          label={t("last_lead")}
          value={stats.ultimo_envio ? formatFechaHora(stats.ultimo_envio) : "–"}
          isLong={!!stats.ultimo_envio}
        />
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <DailyBars title={t("visits")} rows={stats.por_dia} measure="visitas" />
        <DailyBars title={t("leads")} rows={stats.por_dia} measure="envios" />
        <details className="text-sm md:col-span-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t("table_view")}
          </summary>
          <div className="mt-2 max-h-56 overflow-y-auto bg-card">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">{t("day")}</th>
                  <th className="py-1 text-right font-medium">{t("visits")}</th>
                  <th className="py-1 text-right font-medium">{t("leads")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...stats.por_dia].reverse().map((row) => (
                  <tr key={row.dia} className="border-t">
                    <td className="py-1">{formatFecha(row.dia)}</td>
                    <td className="py-1 text-right">{row.visitas}</td>
                    <td className="py-1 text-right">{row.envios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Breakdown
          title={t("by_source")}
          rows={namedRows(stats.fuentes)}
          empty={t("no_leads")}
        />
        <Breakdown
          title={t("by_campaign")}
          rows={namedRows(stats.campanias)}
          empty={t("no_leads")}
        />
      </div>

      <section className="rounded-lg border bg-card p-3">
        <h3 className="mb-2 text-sm font-medium">{t("recent")}</h3>
        {stats.recientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("no_leads")}</p>
        ) : (
          <ul className="divide-y">
            {stats.recientes.map((envio) => (
              <li
                key={`${envio.creado_en}-${envio.cliente_id ?? "x"}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-sm"
              >
                {envio.cliente_id != null && conClientes ? (
                  <Link
                    to={`/clientes/${envio.cliente_id}`}
                    className="min-w-0 flex-1 truncate font-medium text-primary hover:underline"
                  >
                    {envio.cliente_nombre}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {envio.cliente_nombre ?? t("no_name")}
                  </span>
                )}
                {envio.cliente_nuevo && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t("new")}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {envio.tipo === "whatsapp" ? t("whatsapp") : t("form")}
                  {" · "}
                  {envio.utm_campaign ||
                    envio.utm_source ||
                    t("no_campaign_data")}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatFechaHora(envio.creado_en)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
