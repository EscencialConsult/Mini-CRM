/**
 * Prueba gratis de una cuenta: cuánto dura y cómo se lee su estado en pantalla.
 *
 * Quien hace cumplir el corte es la base (`privado.cuenta_vigente`, que compara
 * `prueba_hasta` con now()) y quien la controla es la función `cuentas`; esto sólo
 * decide qué mostrar y debe dar la misma respuesta que la base.
 */

/** Cuánto dura una prueba nueva. La fija el servidor (función `cuentas`); acá sólo se muestra. */
export const DIAS_DE_PRUEBA = 3;

export type EstadoPrueba = "sin_prueba" | "en_prueba" | "terminada";

interface ConPrueba {
  /** Hasta cuándo dura; null o ausente = cuenta sin prueba (paga, o la base todavía no tiene la columna). */
  prueba_hasta?: string | null;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const estadoPrueba = (
  cuenta: ConPrueba | null | undefined,
  ahora: number = Date.now(),
): EstadoPrueba => {
  const hasta = cuenta?.prueba_hasta ? Date.parse(cuenta.prueba_hasta) : NaN;
  if (Number.isNaN(hasta)) return "sin_prueba";
  return hasta > ahora ? "en_prueba" : "terminada";
};

/** ¿La cuenta se puede usar? Activa y, si es de prueba, sin vencer (la misma regla que la base). */
export const cuentaVigente = (
  cuenta: (ConPrueba & { activa: boolean }) | null | undefined,
  ahora: number = Date.now(),
): boolean =>
  !!cuenta && cuenta.activa && estadoPrueba(cuenta, ahora) !== "terminada";

export type EstadoCuenta =
  "activa" | "en_prueba" | "prueba_terminada" | "suspendida";

/** El estado de la cuenta para la lista de la plataforma. */
export const estadoCuenta = (
  cuenta: ConPrueba & { activa: boolean },
  ahora: number = Date.now(),
): EstadoCuenta => {
  if (!cuenta.activa) return "suspendida";
  const prueba = estadoPrueba(cuenta, ahora);
  if (prueba === "en_prueba") return "en_prueba";
  return prueba === "terminada" ? "prueba_terminada" : "activa";
};

/**
 * Días que faltan para que venza, redondeados hacia arriba (con 1 hora de margen
 * es «1 día»). Null si la cuenta no está en prueba.
 */
export const diasRestantes = (
  cuenta: ConPrueba | null | undefined,
  ahora: number = Date.now(),
): number | null => {
  if (estadoPrueba(cuenta, ahora) !== "en_prueba") return null;
  const hasta = Date.parse(cuenta?.prueba_hasta ?? "");
  return Math.max(1, Math.ceil((hasta - ahora) / MS_POR_DIA));
};

/** Hace cuántos días terminó la prueba (0 = hoy). Null si no terminó. */
export const diasDesdeQueTermino = (
  cuenta: ConPrueba | null | undefined,
  ahora: number = Date.now(),
): number | null => {
  if (estadoPrueba(cuenta, ahora) !== "terminada") return null;
  const hasta = Date.parse(cuenta?.prueba_hasta ?? "");
  return Math.floor((ahora - hasta) / MS_POR_DIA);
};

export type AccionPrueba = "iniciar" | "extender" | "cortar" | "convertir";

/** «Cortar» fija el vencimiento con el reloj del servidor: se tolera que el de esta máquina vaya atrasado. */
const TOLERANCIA_RELOJ_MS = 60 * 1000;

/**
 * ¿El servidor aplicó de verdad la acción? Una versión vieja de la función `cuentas` ignora
 * el campo `prueba` y devuelve la cuenta sin cambios con un 200: sin esta comprobación la
 * pantalla daría por hecho un corte que no ocurrió. Devuelve el motivo si NO se aplicó.
 */
export const motivoSinAplicar = (
  accion: AccionPrueba,
  cuenta: ConPrueba,
  ahora: number = Date.now(),
): string | null => {
  if (!("prueba_hasta" in cuenta)) {
    return "El servidor todavía no tiene la prueba gratis: falta aplicar la migración y desplegar la función «cuentas».";
  }
  const hasta = cuenta.prueba_hasta ? Date.parse(cuenta.prueba_hasta) : NaN;
  const hayPrueba = !Number.isNaN(hasta);
  const aplicada =
    accion === "convertir"
      ? !hayPrueba
      : accion === "cortar"
        ? hayPrueba && hasta <= ahora + TOLERANCIA_RELOJ_MS
        : hayPrueba && hasta > ahora;
  return aplicada ? null : "El servidor no aplicó el cambio. Probá de nuevo.";
};
