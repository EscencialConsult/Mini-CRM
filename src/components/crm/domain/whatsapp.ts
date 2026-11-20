import { soloDigitos } from "./validators";

/**
 * Saca el «15» de los celulares argentinos de `digitos` (código de área + 15 +
 * abonado: 11 15 5555 1234). El área tiene 2, 3 o 4 dígitos y el total sin el 15
 * son 10: se prueba cada largo de área hasta encontrar el 15 donde corresponde.
 */
const sinQuince = (digitos: string, desde: number) => {
  for (const area of [2, 3, 4]) {
    const inicio = desde + area;
    if (digitos.slice(inicio, inicio + 2) === "15") {
      return digitos.slice(0, inicio) + digitos.slice(inicio + 2);
    }
  }
  return digitos;
};

/**
 * Número listo para wa.me: solo dígitos, con el código de país.
 *
 * Argentina se acepta como la escribe la gente y se deja en el formato que pide
 * WhatsApp (54 9 + área + abonado, sin 0 ni 15):
 *   +54 9 11 5555-1234, +54 11 5555-1234, +54 9 11 15 5555-1234, +54 011 5555-1234,
 *   011 15 5555-1234, 011 5555-1234, 11 15 5555-1234 y 11 5555-1234.
 * Sin código de país, un número de 10 dígitos (o con el 0 de larga distancia) se
 * toma como argentino. Cualquier otro (por ejemplo +591 7…) se respeta tal cual.
 * Null si no alcanza para un número.
 */
export const numeroWhatsapp = (telefono: string | null | undefined) => {
  let digitos = soloDigitos(telefono ?? "");
  // 0054…, 00591…: el 00 es el prefijo de llamada internacional
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length < 8) return null;

  if (digitos.startsWith("54") && digitos.length >= 12) {
    // +54 011 5555-1234: el 0 de larga distancia sobra después del código de país
    if (digitos[2] === "0") digitos = `54${digitos.slice(3)}`;
    // Celular sin el 9 (12 dígitos, o 14 si trae el 15): se lo agrega
    if (
      !digitos.startsWith("549") &&
      (digitos.length === 12 || digitos.length === 14)
    ) {
      digitos = `549${digitos.slice(2)}`;
    }
    if (digitos.startsWith("549") && digitos.length === 15) {
      digitos = sinQuince(digitos, 3);
    }
    return digitos;
  }

  // Sin código de país: formato local argentino
  if (digitos.startsWith("0")) {
    let local = digitos.slice(1);
    if (local.length === 12) local = sinQuince(local, 0);
    if (local.length === 10) return `549${local}`;
  } else if (digitos.length === 10) {
    return `549${digitos}`;
  } else if (/^1115\d{8}$/.test(digitos)) {
    // 11 15 5555-1234 (Buenos Aires sin el 0). Solo se reconoce con el área 11:
    // con otras áreas se confundiría con un número que ya trae su código de país
    return `54911${digitos.slice(4)}`;
  }
  return digitos;
};

export const enlaceWhatsapp = (
  telefono: string | null | undefined,
  texto: string,
) => {
  const numero = numeroWhatsapp(telefono);
  return numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
    : null;
};
