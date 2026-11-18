/**
 * Escritura de celdas CSV para Excel en español (separador `;`, coma decimal).
 *
 * Un texto que Excel o LibreOffice leerían como fórmula (empieza con `=`, `+`,
 * `-`, `@`, tabulación o retorno de carro) se antecede con una comilla simple.
 * Hace falta porque los nombres de los clientes pueden venir de un formulario
 * público: sin esto, un visitante podría ejecutar una fórmula (por ejemplo
 * `=HYPERLINK(...)`) en la planilla de quien exporta.
 */

const PUEDE_SER_FORMULA = /^[\t\r]|^\s*[=+\-@]/;

/**
 * Solo cifras y signos de cuenta: no puede llamar a ninguna función ni apuntar a
 * una celda, así que es inofensivo (teléfonos como «+54 9 11 2233-4455», importes
 * negativos) y se deja tal cual.
 */
const SOLO_CIFRAS = /^[\d\s().,+-]+$/;

const neutralizarFormula = (texto: string): string =>
  PUEDE_SER_FORMULA.test(texto) && !SOLO_CIFRAS.test(texto)
    ? `'${texto}`
    : texto;

/** Una celda lista para escribir en un CSV con `;`. */
export const celdaCsv = (valor: unknown): string => {
  const texto =
    typeof valor === "number"
      ? String(valor).replace(".", ",")
      : neutralizarFormula(String(valor ?? ""));
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};
