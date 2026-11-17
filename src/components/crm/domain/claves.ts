// Sin caracteres que se confunden al dictarlos (0/O, 1/l/I).
const ALFABETO_CLAVE =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Contraseña al azar, segura (crypto), pensada para pasársela a alguien. */
export const generarClave = (largo = 12): string =>
  Array.from(
    crypto.getRandomValues(new Uint32Array(largo)),
    (numero) => ALFABETO_CLAVE[numero % ALFABETO_CLAVE.length],
  ).join("");
