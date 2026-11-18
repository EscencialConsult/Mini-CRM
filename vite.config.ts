import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { isValidSlug } from "./src/components/crm/landings/pagina/schema.ts";

type LandingHandler = (
  request: Request,
  context: { next(): Promise<Response> },
) => Promise<Response>;

/** "/<slug>" y "/<slug>/privacidad" son landings; todo lo demas es del CRM. */
const esRutaDeLanding = (pathname: string) => {
  const partes = pathname
    .split("/")
    .filter(Boolean)
    .map((parte) => {
      try {
        return decodeURIComponent(parte).toLowerCase();
      } catch {
        return "";
      }
    });
  if (partes.length === 0 || partes.length > 2) return false;
  if (partes.length === 2 && partes[1] !== "privacidad") return false;
  return isValidSlug(partes[0]);
};

/**
 * En desarrollo, un mismo servidor sirve el CRM en "/" (sus rutas van en el
 * hash) y las landings publicadas en "/<slug>" y "/<slug>/privacidad", armadas
 * por la misma funcion que en Netlify. Asi un solo host —por ejemplo el de un
 * tunel de Cloudflare— alcanza para compartir las dos cosas.
 */
const landingsLocales = (env: Record<string, string>): Plugin => ({
  name: "landings-locales",
  apply: "serve",
  configureServer(server) {
    let host = "";
    try {
      host = new URL(env.VITE_LANDINGS_URL ?? "").host;
    } catch {
      return;
    }
    (globalThis as { Netlify?: unknown }).Netlify = {
      env: { get: (name: string) => env[name] },
    };
    server.middlewares.use(async (req, res, next) => {
      if (!esRutaDeLanding((req.url ?? "/").split("?")[0])) return next();
      try {
        const { default: handler } = (await server.ssrLoadModule(
          "/netlify/edge-functions/landing.ts",
        )) as { default: LandingHandler };
        const response = await handler(
          new Request(new URL(req.url ?? "/", `http://${host}`)),
          { next: async () => new Response(null, { status: 404 }) },
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === "location") return;
          res.setHeader(key, value);
        });
        const location = response.headers.get("location");
        if (location) {
          // La funcion redirige al host de las landings; por un tunel, el
          // visitante tiene que seguir en el host por el que entro.
          res.setHeader(
            "location",
            new URL(location, `http://${req.headers.host ?? host}`).toString(),
          );
        }
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        next(error);
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      port: 5173,
      // Solo esta máquina (el navegador local y el túnel de compartir.bat llegan igual):
      // el servidor de desarrollo apunta a la base real y no tiene por qué verse en la red
      // local. Para probar desde el celular: DEV_ABRIR_A_LA_RED=1 en .env.local.
      host: env.DEV_ABRIR_A_LA_RED === "1" ? true : "127.0.0.1",
    },
    plugins: [react(), tailwindcss(), landingsLocales(env)],
    base: "./",
    build: {
      sourcemap: true,
    },
    resolve: {
      preserveSymlinks: true,
      dedupe: ["react-router", "react-router-dom"],
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
