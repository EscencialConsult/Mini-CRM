import { soloDigitos } from "./validators";

/**
 * Número listo para wa.me: solo dígitos, con el código de país. Un celular
 * argentino escrito como +54 11 5555-1234 necesita el 9 (+54 9 11 ...): se lo
 * agrega, si no, el enlace puede no abrir el chat. Null si no alcanza para un número.
 */
export const numeroWhatsapp = (telefono: string | null | undefined) => {
  let digitos = soloDigitos(telefono ?? "");
  if (digitos.length < 8) return null;
  if (
    digitos.startsWith("54") &&
    !digitos.startsWith("549") &&
    digitos.length === 12
  ) {
    digitos = `549${digitos.slice(2)}`;
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
