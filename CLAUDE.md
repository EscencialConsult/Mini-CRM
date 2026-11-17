# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Dealflow** (antes «Mini-CRM»: README, comentarios SQL y la clave de localStorage `MiniCRM` conservan el nombre viejo a propósito) es un CRM multi-cliente para PyMEs argentinas. React 19 + TypeScript estricto + Vite 8, `ra-core` / shadcn-admin-kit, Tailwind v4 y Supabase. Producto, dominio y textos en **español**. Las reglas duras (no agregar dependencias, no tocar `supabase/` ni `.env*` sin pedido, no commitear sin pedido, etc.) están en `AGENTS.md`: leelo antes de tocar código. `README.md` documenta módulos y permisos; `DESPLIEGUE.md`, el despliegue; `WHATSAPP.md`, el diseño del bot de pedidos.

## Comandos

```sh
npm run dev          # Vite en :5173 (CRM) y en 127.0.0.1:5173/<slug> (landings locales)
npm run typecheck    # tsc --noEmit -p tsconfig.app.json
npm run lint         # eslint src (no-console salvo warn/error; noUnused* rompe el build)
npm run build        # typecheck + vite build: es la puerta de calidad (no hay tests de UI)
npm run prettier     # solo check; muchos archivos del repo ya NO cumplen: formateá (prettier --write) solo los que tocás
npm run db:push | db:psql -- -c "..." | admin:crear   # necesitan .env.scripts y psql (Node 24, ver .nvmrc)
```

- La única prueba automática es SQL: `supabase/tests/aislamiento_cuentas.sql` (aislamiento entre cuentas). Correrla tras cualquier cambio de base: `npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento_cuentas.sql`.
- Esta máquina no tiene `.env.scripts` ni `psql`: para la base de producción se usa el CLI (`npx supabase db push --remote=<ref> --skip-vault --yes`, `functions deploy … --use-api --no-verify-jwt`). Nada se aplica en producción sin que el usuario lo pida.
- Las páginas autenticadas no se pueden abrir sin credenciales: para verificar UI se usa Edge headless (`--screenshot`) sobre `/#/login` o una página-arnés temporal que importe los componentes (borrarla después). Edge headless impone un ancho mínimo de ~476px: para probar 375px, meter la URL en un `<iframe>`.
- `compartir.bat` expone el servidor de **desarrollo** por un túnel de Cloudflare: es lento por diseño (cientos de módulos sin empaquetar). Para medir velocidad real usar `npm run build && npm run preview`.

## Arquitectura

**Datos y permisos.** `src/components/crm/providers/dataProvider.ts` envuelve `ra-supabase-core` y agrega `rpc<T>()` y métodos de dominio (`landing_publicar`, cuentas, usuarios…); la seguridad real vive en la base (RLS + triggers), la UI solo oculta lo que la base rechazaría. Cada usuario tiene **módulos** (`domain/modulos.ts`, `useModulos()` / `useCrmIdentity()`, `tiene_modulo()` en las políticas). Hay **multi-cliente por `cuenta_id`**: toda tabla de negocio lleva el trigger `trg_00_cuenta_sellar` y la política restrictiva `aislar_cuenta` (patrón en `20261114100000_cuentas.sql`); el usuario «plataforma» administra las cuentas con la Edge Function `cuentas` (y `users` para usuarios). Un módulo nuevo toca varios lugares (ver regla 6 de `AGENTS.md`).

**Rutas y pantallas.** `root/CRM.tsx` registra los recursos; cada uno usa **un solo componente de página** para listado, alta y detalle (`conAcceso(resource, Pagina)` aplica el control de módulo). Alta y detalle se abren sobre el listado **sin volver a montarlo**, vía `shared/RecordDialog`, que es un panel lateral (Sheet). Como los padres lo cierran desmontándolo, `RecordDialog` deja una copia animada para la salida: no lo reemplaces por un modal de Radix sin entender eso. Excepción: el editor de landings es página completa. Nombres de dominio ≠ UI: el recurso `actividades` se ve como «Tareas» y `oportunidades` como «Tablero».

**Landings (la parte más transversal).** `landings/pagina/render.ts` + `schema.ts` generan el HTML público y lo comparten tres consumidores: el lienzo del editor (iframe con `editable: true`, `landings/LandingCanvas*`), la edge function `netlify/edge-functions/landing.ts` y el plugin `landings-locales` de `vite.config.ts` (dev). La edge function solo responde en el host de `VITE_LANDINGS_URL`, que **debe ser distinto del host del CRM**; en cualquier otro host deja pasar. Los envíos van por RPC anónimas (`landing_publica`, `landing_recibir`) que crean cliente + nota + tarea. `render.ts` lleva su propio CSS: no usa los tokens de la app. Las variables `VITE_*` se graban en el build (cambiarlas exige un deploy nuevo).

**Otros bloques.** `netlify/functions/asistente.ts` (`/api/asistente`, Anthropic): lee con el token del usuario (aplica RLS) y las escrituras son solo propuestas que la persona confirma en la UI (`asistente/AsistenteFlotante`). Es un módulo administrable (`asistente` = consultar, `asistente_altas` = registrar prospectos): lo contrata la cuenta y el administrador lo cede por usuario; el servidor lo valida con `tiene_modulo`. La carga masiva de clientes desde CSV (`clientes/importacion/`) es el módulo `importacion` (requiere `clientes`; se gatea solo en la UI, las altas pasan por la RLS de clientes). Las oportunidades usan `asignados uuid[]` (no `asignado_a`, que solo conservan los clientes). Pedidos y su integración con landings/WhatsApp: ver `WHATSAPP.md`. Despliegue: cada `git push` a `main` dispara un deploy en Netlify.

**Sistema de diseño (src/index.css).** Tokens `:root` / `.dark` con `@theme inline`; fuentes Exo 2 (`font-titulo`, títulos y cifras), Jost/Futura (`font-subtitulo`, etiquetas y encabezados de tabla) e Inter (cuerpo); radio base 0.5rem. El degradé de marca (`--marca-1..3`, utilidad `bg-marca`) se reserva para logo, wordmark (`layout/Wordmark.tsx`), login y la barra del ítem activo: el resto va plano (botón principal sólido, estados con `Pill` = punto + texto, acentos neutros). El pedido del usuario es evitar el «aspecto IA» (tarjetas idénticas, degradés, sombras). Íconos propios del menú en `layout/IconosMarca.tsx`; fondo del login estático en `login/FondoLogin.tsx` (sin animaciones, sin cubrir el contenido). `ui/table.tsx` ofrece además una barra de scroll horizontal sincronizada arriba de la tabla. Las áreas táctiles mínimas son de 40px (regla de `AGENTS.md`).
