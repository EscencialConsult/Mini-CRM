import { getSupabaseClient } from "../providers/supabase";

/** `_` y `%` son comodines de LIKE: un email como «ana_gomez@…» no puede coincidir con el de otra persona. */
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

/**
 * El teléfono con el que alguien pidió la prueba (su ficha de cliente en la
 * plataforma), buscado por email. Vacío si no está o si la consulta falla.
 */
export const buscarTelefono = async (email: string): Promise<string> => {
  try {
    const { data } = await getSupabaseClient()
      .from("clientes")
      .select("telefono")
      .ilike("email", escaparLike(email))
      .not("telefono", "is", null)
      .limit(1);
    return (data?.[0]?.telefono as string | undefined) ?? "";
  } catch {
    return "";
  }
};

/**
 * Los teléfonos de varios emails en una sola consulta (clave: email en minúsculas).
 * Los que no tienen ficha o teléfono quedan afuera; si la consulta falla, queda vacío.
 */
export const buscarTelefonos = async (
  emails: readonly string[],
): Promise<Map<string, string>> => {
  const telefonos = new Map<string, string>();
  const pedidos = [
    ...new Set(emails.map((email) => email.trim().toLowerCase())),
  ].filter(Boolean);
  if (pedidos.length === 0) return telefonos;
  try {
    const { data } = await getSupabaseClient()
      .from("clientes")
      .select("email, telefono")
      .in("email", pedidos)
      .not("telefono", "is", null);
    for (const fila of data ?? []) {
      const email = String(fila.email ?? "")
        .trim()
        .toLowerCase();
      const telefono = String(fila.telefono ?? "").trim();
      if (email && telefono && !telefonos.has(email))
        telefonos.set(email, telefono);
    }
  } catch {
    // Sin teléfonos el panel igual se muestra: sólo no ofrece el WhatsApp
  }
  return telefonos;
};
