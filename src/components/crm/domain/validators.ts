export type Validator = (value: unknown) => string | undefined;

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS_CUIT = ["20", "23", "24", "25", "26", "27", "30", "33", "34"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const soloDigitos = (valor: unknown): string =>
  typeof valor === "string" ? valor.replace(/\D/g, "") : "";

/** Verifica el dígito verificador de un CUIT/CUIL de 11 dígitos. */
export const esCuitValido = (cuit: string): boolean => {
  if (!/^\d{11}$/.test(cuit) || !PREFIJOS_CUIT.includes(cuit.slice(0, 2))) {
    return false;
  }
  const suma = PESOS_CUIT.reduce(
    (acumulado, peso, indice) => acumulado + peso * Number(cuit[indice]),
    0,
  );
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(cuit[10]);
};

/** DNI de 7-8 dígitos o CUIT/CUIL de 11 con dígito verificador. Vacío es válido. */
export const validarDocumento: Validator = (valor) => {
  const digitos = soloDigitos(valor);
  if (!digitos) return undefined;
  if (digitos.length === 7 || digitos.length === 8) return undefined;
  if (digitos.length === 11) {
    return esCuitValido(digitos) ? undefined : "El CUIT/CUIL no es válido";
  }
  return "Ingresá un DNI (7 u 8 dígitos) o un CUIT/CUIL (11 dígitos)";
};

export const validarTelefono: Validator = (valor) => {
  if (typeof valor !== "string" || !valor.trim()) return undefined;
  if (!/^[+\d][\d\s()\-.]*$/.test(valor.trim())) {
    return "Solo números, espacios, + ( ) y guiones";
  }
  const digitos = soloDigitos(valor).length;
  return digitos >= 6 && digitos <= 15
    ? undefined
    : "Debe tener entre 6 y 15 dígitos";
};

export const validarEmail: Validator = (valor) =>
  typeof valor === "string" && valor.trim() && !EMAIL_REGEX.test(valor.trim())
    ? "Ingresá un email válido"
    : undefined;

export const validarEmailObligatorio: Validator = (valor) =>
  typeof valor === "string" && valor.trim()
    ? validarEmail(valor)
    : "Campo obligatorio";

export const validarObligatorio: Validator = (valor) =>
  valor === null ||
  valor === undefined ||
  (typeof valor === "string" && !valor.trim())
    ? "Campo obligatorio"
    : undefined;

export const validarImporte: Validator = (valor) => {
  if (valor === null || valor === undefined || valor === "") return undefined;
  return Number(valor) >= 0 ? undefined : "El importe no puede ser negativo";
};

export const validarProbabilidad: Validator = (valor) => {
  if (valor === null || valor === undefined || valor === "") return undefined;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 && numero <= 100
    ? undefined
    : "Ingresá un entero entre 0 y 100";
};

export const validarClave: Validator = (valor) =>
  typeof valor === "string" && valor.length >= 8
    ? undefined
    : "Debe tener al menos 8 caracteres";

/** Hora "HH:mm" en 24 h. */
export const validarHora: Validator = (valor) =>
  typeof valor === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
    ? undefined
    : "Usá el formato HH:mm";
