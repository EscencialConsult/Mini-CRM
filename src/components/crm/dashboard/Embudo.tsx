import { useEffect, useState, type CSSProperties } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatMoneda } from "../domain/format";
import { ETAPAS, nombreDe } from "../domain/options";
import type { EmbudoEtapa } from "../domain/types";
import { ChartCard } from "./ChartCard";
import { useEmbudo } from "./usePanel";

// La barra más larga ocupa como máximo este porcentaje de la pista: el resto
// queda libre para el valor al final de la barra.
const LARGO_MAXIMO = 70;

const ancho = (porcentaje: number): CSSProperties =>
  ({ "--ancho": `${porcentaje}%` }) as CSSProperties;

const descripcionEtapa = (dato: EmbudoEtapa): string =>
  `${nombreDe(ETAPAS, dato.etapa)}: ${dato.cantidad} oportunidades abiertas por ${formatMoneda(dato.importe)}`;

const Grafico = ({ datos }: { datos: EmbudoEtapa[] }) => {
  const [dibujado, setDibujado] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setDibujado(true));
    return () => cancelAnimationFrame(cuadro);
  }, []);

  const maximo = Math.max(0, ...datos.map((dato) => dato.cantidad));
  const total = datos.reduce((suma, dato) => suma + dato.cantidad, 0);

  if (maximo === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No hay oportunidades abiertas.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {datos.map((dato) => (
        <li
          key={dato.etapa}
          role="img"
          tabIndex={0}
          aria-label={descripcionEtapa(dato)}
          onMouseEnter={() => setActivo(dato.etapa)}
          onMouseLeave={() => setActivo(null)}
          onFocus={() => setActivo(dato.etapa)}
          onBlur={() => setActivo(null)}
          className="relative grid grid-cols-[6.5rem_1fr] items-center gap-3 rounded-sm py-1 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-sm">{nombreDe(ETAPAS, dato.etapa)}</span>
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-(--ancho) min-w-0.5 rounded-r-[4px] bg-viz-1 transition-[width] duration-300"
              style={ancho(
                dibujado ? (dato.cantidad / maximo) * LARGO_MAXIMO : 0,
              )}
            />
            <span className="text-sm whitespace-nowrap tabular-nums">
              {dato.cantidad}
              <span className="text-muted-foreground">
                {" "}
                · {formatMoneda(dato.importe)}
              </span>
            </span>
          </div>
          {activo === dato.etapa && (
            <div
              role="tooltip"
              className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 space-y-0.5 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
            >
              <p className="font-medium">{nombreDe(ETAPAS, dato.etapa)}</p>
              <p>
                {dato.cantidad} abiertas · {formatMoneda(dato.importe)}
              </p>
              <p className="text-muted-foreground">
                {Math.round((dato.cantidad / total) * 100)} % de las
                oportunidades abiertas
              </p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};

const Tabla = ({ datos }: { datos: EmbudoEtapa[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead scope="col">Etapa</TableHead>
        <TableHead scope="col" className="text-right">
          Oportunidades abiertas
        </TableHead>
        <TableHead scope="col" className="text-right">
          Importe
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {datos.map((dato) => (
        <TableRow key={dato.etapa}>
          <TableCell>{nombreDe(ETAPAS, dato.etapa)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {dato.cantidad}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoneda(dato.importe)}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

/** Embudo: oportunidades abiertas por etapa de negociación. */
export const Embudo = () => {
  const { data, isPending, error } = useEmbudo();
  const datos = data ?? [];

  return (
    <ChartCard
      titulo="Embudo de ventas"
      descripcion="Oportunidades abiertas según su etapa de negociación."
      isPending={isPending}
      error={error}
      grafico={<Grafico datos={datos} />}
      tabla={<Tabla datos={datos} />}
    />
  );
};
