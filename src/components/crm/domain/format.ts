const LOCALE = "es-AR";

const moneda = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const numero = new Intl.NumberFormat(LOCALE);
const porcentaje = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
});
const fechaCorta = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const mesAnio = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  year: "2-digit",
});

export const formatMoneda = (valor: number | null | undefined): string =>
  moneda.format(valor ?? 0);

export const formatNumero = (valor: number | null | undefined): string =>
  numero.format(valor ?? 0);

/** 1 → "1 tarea", 3 → "3 tareas". */
export const plural = (
  cantidad: number,
  singular: string,
  pluralTexto: string,
): string =>
  `${formatNumero(cantidad)} ${cantidad === 1 ? singular : pluralTexto}`;

/** 0.125 → "12,5 %". */
export const formatPorcentaje = (fraccion: number): string =>
  porcentaje.format(fraccion);

/** Convierte "YYYY-MM-DD" a fecha local (evita el corrimiento por zona horaria). */
export const parseFechaLocal = (valor: string): Date => {
  const [anio, mes, dia] = valor.slice(0, 10).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
};

/** Acepta una fecha "YYYY-MM-DD" o un instante ISO. */
const aFecha = (valor: string): Date =>
  /^\d{4}-\d{2}-\d{2}$/.test(valor) ? parseFechaLocal(valor) : new Date(valor);

export const formatFecha = (valor: string | null | undefined): string =>
  valor ? fechaCorta.format(aFecha(valor)) : "";

export const formatFechaHora = (valor: string | null | undefined): string =>
  valor ? fechaHora.format(aFecha(valor)) : "";

export const formatMes = (valor: string): string =>
  mesAnio.format(parseFechaLocal(valor));

/** "YYYY-MM-DD" de una fecha en hora local. */
export const aIsoFecha = (fecha: Date): string => {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

export const hoyIso = (): string => aIsoFecha(new Date());

/** Formatea CUIT/CUIL (XX-XXXXXXXX-X) o DNI (XX.XXX.XXX) a partir de dígitos. */
export const formatDocumento = (
  documento: string | null | undefined,
): string => {
  const digitos = (documento ?? "").replace(/\D/g, "");
  if (digitos.length === 11) {
    return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
  }
  if (digitos.length >= 7 && digitos.length <= 8) {
    return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  return documento ?? "";
};

export const etiquetaDocumento = (
  documento: string | null | undefined,
): string => ((documento ?? "").length === 11 ? "CUIT/CUIL" : "DNI");

export const iniciales = (nombre: string | null | undefined): string =>
  (nombre ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

/** Enlace para llamar: `tel:` con los dígitos (y el + si lo tenía). */
export const enlaceTelefono = (telefono: string | null | undefined) => {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 6) return null;
  return `tel:${(telefono ?? "").trim().startsWith("+") ? "+" : ""}${digitos}`;
};

/**
 * Enlace de WhatsApp (wa.me) para un teléfono argentino: sin el 0 ni el 00 de
 * discado, y los celulares de 10 dígitos con el 549 delante.
 */
export const enlaceWhatsApp = (telefono: string | null | undefined) => {
  let digitos = (telefono ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `549${digitos}`;
  else if (
    digitos.startsWith("54") &&
    !digitos.startsWith("549") &&
    digitos.length === 12
  ) {
    digitos = `549${digitos.slice(2)}`;
  }
  return digitos.length >= 11 && digitos.length <= 15
    ? `https://wa.me/${digitos}`
    : null;
};
