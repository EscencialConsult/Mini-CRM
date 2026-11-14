import { cn } from "@/lib/utils";

/**
 * Nombre de la marca con el mismo degradé del isotipo: «Deal» liviano y «flow»
 * en negrita con el degradé turquesa → lavanda → rosa. Hereda el tamaño del
 * contenedor (`className`); la tipografía es la de títulos (`font-titulo`).
 */
export const Wordmark = ({ className }: { className?: string }) => (
  <span
    aria-label="Dealflow"
    className={cn("font-titulo inline-flex items-baseline", className)}
  >
    <span aria-hidden className="font-light tracking-tight">
      Deal
    </span>
    <span
      aria-hidden
      className="bg-marca bg-clip-text font-extrabold tracking-tight text-transparent"
    >
      flow
    </span>
  </span>
);
