import type { Identifier } from "ra-core";

import { landingPath } from "./pagina/schema.ts";

/**
 * Origen público de las landings (VITE_LANDINGS_URL), por ejemplo
 * `https://paginas.midominio.com`. Nunca el del CRM: una landing y sus píxeles
 * no deben compartir origen con la sesión.
 */
export const LANDINGS_URL: string = (
  import.meta.env.VITE_LANDINGS_URL ?? ""
).replace(/\/+$/, "");

/** El host como se lee, sin protocolo: "paginas.midominio.com". */
export const LANDINGS_HOST = LANDINGS_URL.replace(/^https?:\/\//, "");

/** "paginas.midominio.com/rrhh": la dirección como la lee la gente. */
export const landingAddress = (slug: string) =>
  `${LANDINGS_HOST}${landingPath(slug)}`;

export const landingUrl = (slug: string) =>
  `${LANDINGS_URL}${landingPath(slug)}`;

/** El listado de clientes, filtrado a los que llegaron por esta landing. */
export const landingLeadsPath = (landingId: Identifier) =>
  `/clientes?filter=${encodeURIComponent(
    JSON.stringify({ landing_id: Number(landingId) }),
  )}`;
