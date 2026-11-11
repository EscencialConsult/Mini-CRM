import {
  landingContentSecurityPolicy,
  renderLandingNotFound,
  renderLandingPage,
  renderPrivacyPage,
} from "../../src/components/crm/landings/pagina/render.ts";
import {
  isValidSlug,
  type LandingContent,
  landingPath,
  normalizeLandingContent,
} from "../../src/components/crm/landings/pagina/schema.ts";

/**
 * Sirve las landings publicadas en `<VITE_LANDINGS_URL>/<slug>` y
 * `<VITE_LANDINGS_URL>/<slug>/privacidad`, en el mismo sitio de Netlify que el
 * CRM pero en un host propio (un alias de dominio para todas). Cualquier otro
 * host, el del CRM incluido, sigue de largo.
 *
 * Variables del sitio: VITE_SUPABASE_URL, VITE_SB_PUBLISHABLE_KEY y
 * VITE_LANDINGS_URL (las mismas del build).
 */
declare const Netlify: { env: { get(name: string): string | undefined } };

interface EdgeContext {
  next(): Promise<Response>;
}

interface PublicLanding {
  id: number;
  nombre: string;
  slug: string;
  contenido: unknown;
}

/**
 * Los headers de netlify.toml no se aplican a las edge functions. Netlify no
 * documenta el dominio como parte de su clave de caché: `Host` evita que una
 * respuesta de este host se sirva en el del CRM.
 */
const headersFor = (
  supabaseUrl: string,
  cacheable: boolean,
  content?: LandingContent,
) => ({
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": landingContentSecurityPolicy(supabaseUrl, content),
  "cache-control": "public, max-age=0, must-revalidate",
  ...(cacheable
    ? {
        "netlify-cdn-cache-control":
          "public, max-age=60, stale-while-revalidate=300",
        vary: "Host",
        "netlify-vary": "header=Host",
      }
    : { "netlify-cdn-cache-control": "no-store" }),
});

const notFound = (supabaseUrl: string, status: number, cacheable: boolean) =>
  new Response(renderLandingNotFound(), {
    status,
    headers: headersFor(supabaseUrl, cacheable),
  });

/** "/rrhh" y "/rrhh/" son la página; "/rrhh/privacidad", su política. */
const parsePath = (pathname: string) => {
  const [slug = "", page = "", ...rest] = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part).toLowerCase());
  if (rest.length || (page && page !== "privacidad")) return null;
  return { slug, isPrivacy: page === "privacidad" };
};

const hostOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
};

export default async (request: Request, context: EdgeContext) => {
  const url = new URL(request.url);
  const landingsHost = hostOf(Netlify.env.get("VITE_LANDINGS_URL"));
  if (!landingsHost || url.hostname.toLowerCase() !== landingsHost) {
    return context.next();
  }

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const apiKey = Netlify.env.get("VITE_SB_PUBLISHABLE_KEY");
  if (!supabaseUrl || !apiKey) {
    console.error("landing.missing_environment");
    return notFound("'none'", 503, false);
  }

  let route: ReturnType<typeof parsePath>;
  try {
    route = parsePath(url.pathname);
  } catch {
    route = null;
  }
  if (!route || !isValidSlug(route.slug)) {
    return notFound(supabaseUrl, 404, true);
  }
  // Una sola dirección por página: la que enlazan los anuncios y la que se cachea
  if (!route.isPrivacy && url.pathname !== landingPath(route.slug)) {
    return Response.redirect(
      new URL(`${landingPath(route.slug)}${url.search}`, url),
      301,
    );
  }

  const found = await fetch(`${supabaseUrl}/rest/v1/rpc/landing_publica`, {
    method: "POST",
    headers: { apikey: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ p_slug: route.slug }),
  }).catch((error) => {
    console.error("landing.fetch_failed", error);
    return null;
  });
  if (!found?.ok) return notFound(supabaseUrl, 503, false);

  const landing = (await found.json()) as PublicLanding | null;
  if (!landing) return notFound(supabaseUrl, 404, true);

  const content = normalizeLandingContent(landing.contenido);
  const html = route.isPrivacy
    ? renderPrivacyPage(content, route.slug)
    : renderLandingPage(content, {
        slug: route.slug,
        submitUrl: `${supabaseUrl}/rest/v1/rpc/landing_recibir`,
        apiKey,
      });
  return new Response(html, {
    headers: headersFor(supabaseUrl, true, content),
  });
};

export const config = {
  path: "/*",
  // Los archivos del CRM nunca la necesitan
  excludedPath: ["/assets/*"],
  cache: "manual",
};
