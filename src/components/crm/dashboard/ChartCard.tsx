import type { ReactNode } from "react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ChartCardProps {
  titulo: string;
  descripcion: string;
  isPending: boolean;
  error: unknown;
  /** Leyenda (obligatoria con 2 o más series; ninguna con una sola). */
  leyenda?: ReactNode;
  /** El gráfico y su alternativa en tabla reciben el mismo dato ya cargado. */
  grafico: ReactNode;
  tabla: ReactNode;
}

const Vista = {
  grafico: "grafico",
  tabla: "tabla",
} as const;

/**
 * Contenedor de un gráfico del panel: título, estado propio de carga y error,
 * y alternancia gráfico/tabla (la tabla es la alternativa accesible).
 */
export const ChartCard = ({
  titulo,
  descripcion,
  isPending,
  error,
  leyenda,
  grafico,
  tabla,
}: ChartCardProps) => {
  const [vista, setVista] = useState<string>(Vista.grafico);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{titulo}</CardTitle>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={vista}
          onValueChange={(valor) => valor && setVista(valor)}
          aria-label={`Vista de ${titulo}`}
        >
          <ToggleGroupItem value={Vista.grafico}>Gráfico</ToggleGroupItem>
          <ToggleGroupItem value={Vista.tabla}>Tabla</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <Skeleton className="h-56 w-full" aria-label="Cargando" />
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            No se pudo cargar este gráfico.
          </p>
        ) : (
          <>
            {vista === Vista.grafico && leyenda}
            {vista === Vista.grafico ? grafico : tabla}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const MarcaLeyenda = ({
  color,
  etiqueta,
}: {
  color: string;
  etiqueta: string;
}) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
    <span aria-hidden className={`size-2.5 rounded-sm ${color}`} />
    {etiqueta}
  </span>
);
