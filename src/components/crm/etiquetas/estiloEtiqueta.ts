import type { ColorEtiqueta } from "../domain/types";

/** Clases de cada color (escritas enteras para que Tailwind las genere). */
export const CLASES_ETIQUETA: Record<ColorEtiqueta, string> = {
  gris: "border-etiqueta-gris/30 bg-etiqueta-gris/15 text-etiqueta-gris",
  rojo: "border-etiqueta-rojo/30 bg-etiqueta-rojo/15 text-etiqueta-rojo",
  naranja:
    "border-etiqueta-naranja/30 bg-etiqueta-naranja/15 text-etiqueta-naranja",
  ambar: "border-etiqueta-ambar/30 bg-etiqueta-ambar/15 text-etiqueta-ambar",
  verde: "border-etiqueta-verde/30 bg-etiqueta-verde/15 text-etiqueta-verde",
  turquesa:
    "border-etiqueta-turquesa/30 bg-etiqueta-turquesa/15 text-etiqueta-turquesa",
  azul: "border-etiqueta-azul/30 bg-etiqueta-azul/15 text-etiqueta-azul",
  violeta:
    "border-etiqueta-violeta/30 bg-etiqueta-violeta/15 text-etiqueta-violeta",
  rosa: "border-etiqueta-rosa/30 bg-etiqueta-rosa/15 text-etiqueta-rosa",
};

/** Punto de color sólido (selector de color, opciones del desplegable). */
export const PUNTO_ETIQUETA: Record<ColorEtiqueta, string> = {
  gris: "bg-etiqueta-gris",
  rojo: "bg-etiqueta-rojo",
  naranja: "bg-etiqueta-naranja",
  ambar: "bg-etiqueta-ambar",
  verde: "bg-etiqueta-verde",
  turquesa: "bg-etiqueta-turquesa",
  azul: "bg-etiqueta-azul",
  violeta: "bg-etiqueta-violeta",
  rosa: "bg-etiqueta-rosa",
};
