import { getSupabaseClient } from "./supabase";

/**
 * Verificación en dos pasos (app de autenticación, TOTP) con Supabase Auth.
 *
 * La usa el dueño del sistema (la plataforma): la función `cuentas` exige que
 * la sesión haya confirmado el segundo paso (nivel `aal2`) en cuanto él lo
 * activa. Si todavía no lo activó, no se le pide nada.
 */

export interface EstadoMfa {
  /** Tiene una app de autenticación vinculada y confirmada. */
  activada: boolean;
  /** Id de ese factor, para poder desactivarlo. */
  factorId: string | null;
  /** Esta sesión ya confirmó el segundo paso (nivel aal2). */
  sesionConfirmada: boolean;
}

export interface InscripcionMfa {
  factorId: string;
  /** Imagen del QR, lista para un `<img src>`. */
  qr: string;
  /** La misma clave en texto, por si no se puede escanear. */
  secreto: string;
}

const NOMBRE_DEL_FACTOR = "Aplicación de autenticación";

/** El mensaje de Supabase, en castellano y sin detalles técnicos. */
const traducirError = (error: { code?: string; message: string }): Error => {
  switch (error.code) {
    case "mfa_verification_failed":
    case "mfa_verification_rejected":
      return new Error(
        "El código no es válido o ya venció. Probá con el que muestra ahora tu aplicación.",
      );
    case "mfa_challenge_expired":
      return new Error("El código venció. Probá de nuevo.");
    case "mfa_totp_enroll_not_enabled":
    case "mfa_totp_verify_not_enabled":
      return new Error(
        "La verificación en dos pasos no está habilitada en el proyecto de Supabase.",
      );
    case "insufficient_aal":
      return new Error(
        "Confirmá primero tu identidad con el código de tu aplicación.",
      );
    case "over_request_rate_limit":
      return new Error(
        "Demasiados intentos. Esperá un momento y probá de nuevo.",
      );
    default:
      return new Error("No se pudo completar la operación. Probá de nuevo.");
  }
};

/** Estado de la verificación en dos pasos de quien tiene la sesión abierta. */
export const leerEstadoMfa = async (): Promise<EstadoMfa> => {
  const { mfa } = getSupabaseClient().auth;
  const [factores, nivel] = await Promise.all([
    mfa.listFactors(),
    mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factores.error) throw traducirError(factores.error);
  if (nivel.error) throw traducirError(nivel.error);
  const factor = factores.data.totp[0] ?? null;
  return {
    activada: factor !== null,
    factorId: factor?.id ?? null,
    sesionConfirmada: nivel.data.currentLevel === "aal2",
  };
};

/** Empieza a vincular la aplicación: devuelve el QR que hay que escanear. */
export const iniciarInscripcionMfa = async (): Promise<InscripcionMfa> => {
  const { mfa } = getSupabaseClient().auth;
  // Un intento anterior sin confirmar deja un factor a medias: se descarta para
  // poder empezar de nuevo sin chocar con el nombre
  const previos = await mfa.listFactors();
  if (previos.error) throw traducirError(previos.error);
  for (const factor of previos.data.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await mfa.enroll({
    factorType: "totp",
    friendlyName: NOMBRE_DEL_FACTOR,
    issuer: "Mini-CRM",
  });
  if (error) throw traducirError(error);
  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secreto: data.totp.secret,
  };
};

/**
 * Confirma un código de 6 dígitos. Sirve para terminar de vincular la
 * aplicación y, después, para confirmar el segundo paso de cada sesión.
 */
export const confirmarCodigoMfa = async (
  factorId: string,
  codigo: string,
): Promise<void> => {
  const { error } = await getSupabaseClient().auth.mfa.challengeAndVerify({
    factorId,
    code: codigo.replace(/\s+/g, ""),
  });
  if (error) throw traducirError(error);
};

/** Desvincula la aplicación (Supabase pide que la sesión esté confirmada). */
export const desactivarMfa = async (factorId: string): Promise<void> => {
  const { error } = await getSupabaseClient().auth.mfa.unenroll({ factorId });
  if (error) throw traducirError(error);
};
