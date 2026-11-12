import type { LineaProducto } from "../domain/types";

/** Línea vacía: la cantidad y el descuento ya cargados; el precio sale del producto. */
export const LINEA_VACIA = {
  producto_id: null,
  cantidad: 1,
  precio_unitario: 0,
  descuento: 0,
};

export type LineaFormulario = Partial<Omit<LineaProducto, "producto_id">> & {
  producto_id: number | null;
};

/** Mismo cálculo que la base (trigger `oportunidades_productos`). */
export const subtotalDe = (linea: LineaFormulario | undefined): number => {
  const cantidad = Number(linea?.cantidad) || 0;
  const precio = Number(linea?.precio_unitario) || 0;
  const descuento = Number(linea?.descuento) || 0;
  return Math.round(cantidad * precio * (1 - descuento / 100) * 100) / 100;
};
