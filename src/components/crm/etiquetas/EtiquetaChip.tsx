import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ColorEtiqueta } from "../domain/types";
import { CLASES_ETIQUETA } from "./estiloEtiqueta";
import { useEtiquetas } from "./useEtiquetas";

/** Una etiqueta con su color. `children` va al final (botón de quitar…). */
export const EtiquetaChip = ({
  nombre,
  color,
  className,
  children,
}: {
  nombre: string;
  color: ColorEtiqueta;
  className?: string;
  children?: ReactNode;
}) => (
  <Badge
    variant="outline"
    className={cn("max-w-full", CLASES_ETIQUETA[color], className)}
  >
    <span className="truncate">{nombre}</span>
    {children}
  </Badge>
);

/**
 * Las etiquetas de un cliente, a partir de sus ids. Con `maximo`, las que no
 * entran se resumen en "+N" (el nombre de todas queda en el título).
 */
export const EtiquetasCliente = ({
  ids,
  maximo,
  className,
}: {
  ids: readonly number[] | null | undefined;
  maximo?: number;
  className?: string;
}) => {
  const { porId } = useEtiquetas();
  const etiquetas = (ids ?? []).flatMap((id) => porId.get(id) ?? []);
  if (!etiquetas.length) return null;
  const visibles =
    maximo === undefined ? etiquetas : etiquetas.slice(0, maximo);
  const resto = etiquetas.length - visibles.length;

  return (
    <ul
      aria-label="Etiquetas"
      title={
        resto > 0
          ? etiquetas.map((etiqueta) => etiqueta.nombre).join(", ")
          : undefined
      }
      className={cn("flex min-w-0 flex-wrap gap-1", className)}
    >
      {visibles.map((etiqueta) => (
        <li key={etiqueta.id} className="min-w-0">
          <EtiquetaChip nombre={etiqueta.nombre} color={etiqueta.color} />
        </li>
      ))}
      {resto > 0 && (
        <li>
          <Badge variant="outline" className="text-muted-foreground">
            +{resto}
          </Badge>
        </li>
      )}
    </ul>
  );
};
