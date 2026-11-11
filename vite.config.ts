import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

type LandingHandler = (
  request: Request,
  context: { next(): Promise<Response> },
) => Promise<Response>;

/**
 * En desarrollo, las landings publicadas se ven en VITE_LANDINGS_URL: otro host
 * del mismo servidor (por ejemplo http://127.0.0.1:5173 si el CRM se abre en
 * localhost), servido por la misma función que en Netlify.
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
      if (req.headers.host !== host) return next();
      try {
        const { default: handler } = (await server.ssrLoadModule(
          "/netlify/edge-functions/landing.ts",
        )) as { default: LandingHandler };
        const response = await handler(
          new Request(new URL(req.url ?? "/", `http://${host}`)),
          { next: async () => new Response(null, { status: 404 }) },
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        next(error);
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    landingsLocales(loadEnv(mode, process.cwd(), "")),
  ],
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
}));
