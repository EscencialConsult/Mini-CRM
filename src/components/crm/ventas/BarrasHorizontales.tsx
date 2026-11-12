import { useEffect, useState, type CSSProperties } from "react";

// La barra más larga ocupa como máximo este porcentaje de la pista: el resto
// queda libre para el valor al final de la barra.
const LARGO_MAXIMO = 70;

const ancho = (porcentaje: number): CSSProperties =>
  ({ "--ancho": `${porcentaje}%` }) as CSSProperties;

export interface BarraDato {
  id: string;
  etiqueta: string;
  /** Lo que mide el largo de la barra. */
  valor: number;
  /** Valor al final de la barra ("$ 1.200.000 · 3 ventas"). */
  texto: string;
  /** Detalle del tooltip (y del nombre accesible). */
  detalle: string[];
}

/**
 * Barras horizontales de una sola serie (sin leyenda: el título la nombra),
 * ordenadas como llegan. Pasar el mouse o el foco muestra el detalle.
 */
export const BarrasHorizontales = ({
  datos,
  vacio,
}: {
  datos: BarraDato[];
  vacio: string;
}) => {
  const [dibujado, setDibujado] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setDibujado(true));
    return () => cancelAnimationFrame(cuadro);
  }, []);

  const maximo = Math.max(0, ...datos.map((dato) => dato.valor));
  if (maximo === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {vacio}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {datos.map((dato) => (
        <li
          key={dato.id}
          role="img"
          tabIndex={0}
          aria-label={`${dato.etiqueta}: ${dato.detalle.join(", ")}`}
          onMouseEnter={() => setActivo(dato.id)}
          onMouseLeave={() => setActivo(null)}
          onFocus={() => setActivo(dato.id)}
          onBlur={() => setActivo(null)}
          className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-sm py-1 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,12rem)_1fr]"
        >
          <span className="truncate text-sm" title={dato.etiqueta}>
            {dato.etiqueta}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="h-5 w-(--ancho) min-w-0.5 shrink-0 rounded-r-[4px] bg-viz-1 transition-[width] duration-300"
              style={ancho(dibujado ? (dato.valor / maximo) * LARGO_MAXIMO : 0)}
            />
            <span className="truncate text-sm whitespace-nowrap tabular-nums">
              {dato.texto}
            </span>
          </div>
          {activo === dato.id && (
            <div
              role="tooltip"
              className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 space-y-0.5 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
            >
              <p className="font-medium">{dato.etiqueta}</p>
              {dato.detalle.map((linea) => (
                <p key={linea}>{linea}</p>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};
