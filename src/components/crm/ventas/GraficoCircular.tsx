import { useState } from "react";

export interface PorcionDato {
  id: string;
  etiqueta: string;
  /** Lo que mide el arco. */
  valor: number;
  /** Valor para la leyenda ("$ 1.200.000"). */
  texto: string;
  /** Detalle del nombre accesible. */
  detalle: string[];
}

// Las 4 más grandes llevan color propio; el resto se junta en «Otros».
const MAXIMO_PORCIONES = 5;
const COLORES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const RADIO = 15.9155; // circunferencia = 100: el largo del arco es el porcentaje
const formatoPorcentaje = (valor: number) =>
  `${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;

/**
 * Gráfico circular (anillo) de una sola magnitud, con leyenda al costado.
 * Pasar el mouse o el foco por una porción (o su fila) la resalta.
 */
export const GraficoCircular = ({
  datos,
  vacio,
}: {
  datos: PorcionDato[];
  vacio: string;
}) => {
  const [activo, setActivo] = useState<string | null>(null);

  const ordenados = [...datos]
    .filter((dato) => dato.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const total = ordenados.reduce((suma, dato) => suma + dato.valor, 0);
  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {vacio}
      </p>
    );
  }

  const principales = ordenados.slice(0, MAXIMO_PORCIONES - 1);
  const resto = ordenados.slice(MAXIMO_PORCIONES - 1);
  const porciones: PorcionDato[] =
    resto.length > 0
      ? [
          ...principales,
          {
            id: "otros",
            etiqueta: "Otros",
            valor: resto.reduce((suma, dato) => suma + dato.valor, 0),
            texto: "",
            detalle: resto.map((dato) => dato.etiqueta),
          },
        ]
      : principales;

  let acumulado = 0;
  const arcos = porciones.map((porcion, indice) => {
    const porcentaje = (porcion.valor / total) * 100;
    const arco = {
      porcion,
      porcentaje,
      desde: acumulado,
      color: COLORES[indice],
    };
    acumulado += porcentaje;
    return arco;
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <svg
        viewBox="0 0 42 42"
        className="size-44 shrink-0 -rotate-90"
        role="img"
        aria-label={arcos
          .map(
            ({ porcion, porcentaje }) =>
              `${porcion.etiqueta}: ${formatoPorcentaje(porcentaje)}`,
          )
          .join(", ")}
      >
        {arcos.map(({ porcion, porcentaje, desde, color }) => (
          <circle
            key={porcion.id}
            cx="21"
            cy="21"
            r={RADIO}
            fill="none"
            stroke={color}
            strokeWidth={activo === porcion.id ? 7 : 5.5}
            // Un hilo de separación entre porciones, salvo si hay una sola
            strokeDasharray={`${Math.max(porcentaje - (arcos.length > 1 ? 0.6 : 0), 0.01)} ${100 - porcentaje + (arcos.length > 1 ? 0.6 : 0)}`}
            strokeDashoffset={-desde}
            opacity={activo && activo !== porcion.id ? 0.45 : 1}
            className="transition-[stroke-width,opacity] duration-150"
            onMouseEnter={() => setActivo(porcion.id)}
            onMouseLeave={() => setActivo(null)}
          />
        ))}
      </svg>
      <ul className="min-w-0 space-y-1.5">
        {arcos.map(({ porcion, porcentaje, color }) => (
          <li
            key={porcion.id}
            tabIndex={0}
            title={porcion.detalle.join(" · ")}
            onMouseEnter={() => setActivo(porcion.id)}
            onMouseLeave={() => setActivo(null)}
            onFocus={() => setActivo(porcion.id)}
            onBlur={() => setActivo(null)}
            className="flex items-center gap-2 rounded-sm px-1 py-0.5 text-sm outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">{porcion.etiqueta}</span>
            <span className="ml-auto pl-3 whitespace-nowrap tabular-nums">
              {porcion.texto && `${porcion.texto} · `}
              <span className="text-muted-foreground">
                {formatoPorcentaje(porcentaje)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
