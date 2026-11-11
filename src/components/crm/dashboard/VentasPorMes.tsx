import { useEffect, useState, type CSSProperties } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatMes, formatMoneda } from "../domain/format";
import type { VentasPorMes as VentasPorMesDato } from "../domain/types";
import { ChartCard, MarcaLeyenda } from "./ChartCard";
import { useVentasPorMes } from "./usePanel";

const compacto = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Tope "redondo" del eje (1, 2, 5 × 10ⁿ) para que las marcas queden en números limpios. */
const topeDeEscala = (maximo: number): number => {
  if (maximo <= 0) return 1000;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  const factor = maximo / potencia;
  const paso = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  return paso * potencia;
};

const resumenAccesible = (dato: VentasPorMesDato): string =>
  `${formatMes(dato.mes)}: ganadas ${dato.ganadas_cantidad} por ${formatMoneda(dato.ganadas_importe)}, perdidas ${dato.perdidas_cantidad} por ${formatMoneda(dato.perdidas_importe)}`;

const altura = (porcentaje: number): CSSProperties =>
  ({ "--alto": `${porcentaje}%` }) as CSSProperties;

interface BarraProps {
  clase: string;
  porcentaje: number;
  rotulo?: string;
}

/** Columna de 20 px, esquinas superiores de 4 px y base recta. */
const Barra = ({ clase, porcentaje, rotulo }: BarraProps) => (
  <div
    className={`relative h-(--alto) w-5 rounded-t-[4px] transition-[height] duration-300 ${clase}`}
    style={altura(porcentaje)}
  >
    {rotulo && (
      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-foreground">
        {rotulo}
      </span>
    )}
  </div>
);

const Grafico = ({ datos }: { datos: VentasPorMesDato[] }) => {
  const [dibujado, setDibujado] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setDibujado(true));
    return () => cancelAnimationFrame(cuadro);
  }, []);

  const maximoDato = Math.max(
    0,
    ...datos.flatMap((dato) => [dato.ganadas_importe, dato.perdidas_importe]),
  );
  const tope = topeDeEscala(maximoDato);
  const marcas = [tope, tope / 2, 0];
  const porcentaje = (importe: number) =>
    dibujado ? (importe / tope) * 100 : 0;

  if (maximoDato === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay ventas cerradas en los últimos meses.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2">
      <div
        aria-hidden
        className="flex h-48 flex-col justify-between pt-0 text-right text-xs text-muted-foreground tabular-nums"
      >
        {marcas.map((marca) => (
          <span
            key={marca}
            className="-translate-y-1/2 first:translate-y-0 last:translate-y-1/2"
          >
            {compacto.format(marca)}
          </span>
        ))}
      </div>

      <div>
        <div className="relative h-48">
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col justify-between"
          >
            {marcas.map((marca) => (
              <div key={marca} className="border-t border-border" />
            ))}
          </div>
          <div className="absolute inset-0 grid grid-flow-col auto-cols-fr">
            {datos.map((dato) => {
              const etiquetarGanadas =
                dato.ganadas_importe === maximoDato && maximoDato > 0;
              const etiquetarPerdidas =
                !etiquetarGanadas && dato.perdidas_importe === maximoDato;
              return (
                <div
                  key={dato.mes}
                  role="img"
                  tabIndex={0}
                  aria-label={resumenAccesible(dato)}
                  onMouseEnter={() => setActivo(dato.mes)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(dato.mes)}
                  onBlur={() => setActivo(null)}
                  className="relative flex items-end justify-center gap-0.5 rounded-sm outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Barra
                    clase="bg-viz-1"
                    porcentaje={porcentaje(dato.ganadas_importe)}
                    rotulo={
                      etiquetarGanadas
                        ? compacto.format(dato.ganadas_importe)
                        : undefined
                    }
                  />
                  <Barra
                    clase="bg-viz-2"
                    porcentaje={porcentaje(dato.perdidas_importe)}
                    rotulo={
                      etiquetarPerdidas
                        ? compacto.format(dato.perdidas_importe)
                        : undefined
                    }
                  />
                  {activo === dato.mes && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 space-y-1 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
                    >
                      <p className="font-medium">{formatMes(dato.mes)}</p>
                      <p className="flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          aria-hidden
                          className="size-2 rounded-sm bg-viz-1"
                        />
                        Ganadas: {dato.ganadas_cantidad} ·{" "}
                        {formatMoneda(dato.ganadas_importe)}
                      </p>
                      <p className="flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          aria-hidden
                          className="size-2 rounded-sm bg-viz-2"
                        />
                        Perdidas: {dato.perdidas_cantidad} ·{" "}
                        {formatMoneda(dato.perdidas_importe)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div
          aria-hidden
          className="mt-1 grid grid-flow-col auto-cols-fr text-center text-xs text-muted-foreground"
        >
          {datos.map((dato) => (
            <span key={dato.mes}>{formatMes(dato.mes)}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const Tabla = ({ datos }: { datos: VentasPorMesDato[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead scope="col">Mes</TableHead>
        <TableHead scope="col" className="text-right">
          Ganadas
        </TableHead>
        <TableHead scope="col" className="text-right">
          Importe ganado
        </TableHead>
        <TableHead scope="col" className="text-right">
          Perdidas
        </TableHead>
        <TableHead scope="col" className="text-right">
          Importe perdido
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {datos.map((dato) => (
        <TableRow key={dato.mes}>
          <TableCell>{formatMes(dato.mes)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {dato.ganadas_cantidad}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoneda(dato.ganadas_importe)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {dato.perdidas_cantidad}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoneda(dato.perdidas_importe)}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

/** Resumen de ventas: importes ganados y perdidos de los últimos 6 meses. */
export const VentasPorMes = () => {
  const { data, isPending, error } = useVentasPorMes();
  const datos = data ?? [];

  return (
    <ChartCard
      titulo="Resumen de ventas"
      descripcion="Importe de oportunidades cerradas, por mes de cierre (últimos 6 meses)."
      isPending={isPending}
      error={error}
      leyenda={
        <div className="flex flex-wrap gap-4">
          <MarcaLeyenda color="bg-viz-1" etiqueta="Ganadas" />
          <MarcaLeyenda color="bg-viz-2" etiqueta="Perdidas" />
        </div>
      }
      grafico={<Grafico datos={datos} />}
      tabla={<Tabla datos={datos} />}
    />
  );
};
