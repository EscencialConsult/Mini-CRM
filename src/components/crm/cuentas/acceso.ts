/** Lo que se le entrega al titular de una cuenta: dirección, usuario y contraseña. */
export interface CredencialesCuenta {
  titular: string;
  email: string;
  password: string;
  /** Con el que se arma el enlace de WhatsApp; se puede corregir al enviar. */
  telefono: string;
}

/**
 * Accesos recién generados, por id de cuenta, para que la ficha de la cuenta
 * recién creada los muestre al abrirse. Solo en memoria (la contraseña no se
 * guarda en ningún otro lado) y se descartan al cerrar la ficha.
 */
export const accesosPendientes = new Map<number, CredencialesCuenta>();

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
