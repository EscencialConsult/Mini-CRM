/** Lo que se le entrega al titular de una cuenta: dirección, usuario y contraseña. */
export interface CredencialesCuenta {
  titular: string;
  email: string;
  password: string;
  /** Con el que se arma el enlace de WhatsApp; se puede corregir al enviar. */
  telefono: string;
  /** De dónde sale: la cuenta recién creada, o una contraseña nueva. Sin dato, se toma como nueva. */
  origen?: "alta" | "cambio";
}

/** Si nadie abre la ficha, la contraseña no queda en memoria para siempre. */
const VIDA_DEL_ACCESO_MS = 10 * 60 * 1000;

/**
 * Accesos recién generados, por id de cuenta, para que la ficha de la cuenta
 * recién creada los muestre al abrirse. Solo en memoria (la contraseña no se
 * guarda en ningún otro lado) y se descartan al cerrar la ficha.
 */
export const accesosPendientes = new Map<number, CredencialesCuenta>();

const suscriptores = new Map<
  number,
  Set<(credenciales: CredencialesCuenta) => void>
>();

/** Guarda el acceso de una cuenta y avisa a quienes lo están mostrando. */
export const publicarAcceso = (
  cuentaId: number,
  credenciales: CredencialesCuenta,
) => {
  accesosPendientes.set(cuentaId, credenciales);
  suscriptores.get(cuentaId)?.forEach((aviso) => aviso(credenciales));
  setTimeout(() => {
    if (accesosPendientes.get(cuentaId) === credenciales) {
      accesosPendientes.delete(cuentaId);
    }
  }, VIDA_DEL_ACCESO_MS);
};

/** Avisa cada vez que se publica un acceso nuevo de la cuenta. Devuelve la función para dejar de escuchar. */
export const suscribirAcceso = (
  cuentaId: number,
  aviso: (credenciales: CredencialesCuenta) => void,
): (() => void) => {
  const conjunto = suscriptores.get(cuentaId) ?? new Set();
  conjunto.add(aviso);
  suscriptores.set(cuentaId, conjunto);
  return () => {
    conjunto.delete(aviso);
    if (conjunto.size === 0) suscriptores.delete(cuentaId);
  };
};

export const mensajeAcceso = ({
  titular,
  email,
  password,
}: CredencialesCuenta) =>
  [
    `Hola ${titular}, te paso el acceso a tu prueba de Dealflow:`,
    "",
    window.location.origin,
    `Usuario: ${email}`,
    `Contraseña: ${password}`,
    "",
    "Ya podés entrar. Si querés cambiar la contraseña o tenés alguna duda, escribime por acá.",
  ].join("\n");
