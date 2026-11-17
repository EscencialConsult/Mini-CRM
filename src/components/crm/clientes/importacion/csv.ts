/**
 * Lector de CSV mínimo (sin dependencias): comillas con "" escapadas, saltos de
 * línea dentro de comillas, BOM de Excel y separador `;` `,` o tabulación
 * detectado por la primera línea (Excel en español guarda con `;`).
 */

const SEPARADORES = [";", ",", "\t"] as const;

const detectarSeparador = (texto: string): string => {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  let mejor: string = ";";
  let cantidad = 0;
  for (const separador of SEPARADORES) {
    const veces = primera.split(separador).length - 1;
    if (veces > cantidad) {
      mejor = separador;
      cantidad = veces;
    }
  }
  return mejor;
};

/** Filas de celdas, sin las filas totalmente vacías. */
export const leerCsv = (contenido: string): string[][] => {
  const texto = contenido.replace(/^\uFEFF/, "");
  const separador = detectarSeparador(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  const cerrarCelda = () => {
    fila.push(celda);
    celda = "";
  };
  const cerrarFila = () => {
    cerrarCelda();
    if (fila.some((valor) => valor.trim() !== "")) filas.push(fila);
    fila = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += caracter;
      }
    } else if (caracter === '"' && celda === "") {
      entreComillas = true;
    } else if (caracter === separador) {
      cerrarCelda();
    } else if (caracter === "\n" || caracter === "\r") {
      if (caracter === "\r" && texto[i + 1] === "\n") i++;
      cerrarFila();
    } else {
      celda += caracter;
    }
  }
  if (celda !== "" || fila.length > 0) cerrarFila();
  return filas;
};

/** Una celda lista para escribir en un CSV con `;` (Excel en español). */
export const celdaCsv = (valor: unknown): string => {
  const texto = String(valor ?? "");
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** Texto CSV con BOM, para que Excel respete las tildes. */
export const aCsv = (filas: unknown[][]): string =>
  `\uFEFF${filas.map((fila) => fila.map(celdaCsv).join(";")).join("\r\n")}\r\n`;

/** Descarga un texto como archivo desde el navegador. */
export const descargarArchivo = (nombre: string, contenido: string) => {
  const enlace = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([contenido], { type: "text/csv;charset=utf-8" }),
  );
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
};

/**
 * Texto de un archivo subido. El «CSV» que guarda Excel en Windows viene en
 * Windows-1252, no en UTF-8: se prueba UTF-8 estricto y, si falla, se lee así
 * (si no, «Gómez» llegaría como «G�mez»).
 */
export const leerTexto = async (archivo: File): Promise<string> => {
  const bytes = await archivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};
