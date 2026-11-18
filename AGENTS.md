# AGENTS.md — Mini-CRM

Guía para agentes que trabajen en este repo. **Leela entera antes de tocar código.**

## Qué es

CRM chico para una PyME argentina: clientes, oportunidades (pipeline), actividades, productos, canales, ventas, landings y auditoría. Idioma de producto y de código de dominio: **español**. UI: **shadcn-admin-kit** sobre `ra-core`.

## Stack

| Pieza | Versión / nota |
|---|---|
| React | 19 |
| TypeScript | estricto (`strict`, `noUnusedLocals`, `noUnusedParameters`) |
| Vite | 8 (`npm run dev` / `build`) |
| Tailwind | v4, sin `tailwind.config.js`; tokens en `src/index.css` con `@theme inline` |
| Componentes | shadcn/ui (estilo `new-york`, base `neutral`), Radix, `lucide-react` |
| Datos | `ra-core` + Supabase (`src/components/crm/providers/`) |
| Formularios / fechas / DnD | `react-hook-form`, `date-fns`, `@hello-pangea/dnd` |

## Comandos

```sh
npm run dev        # Vite en local
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint (no-console salvo warn/error)
npm run build      # typecheck + vite build  ← la puerta de calidad
npm run prettier   # check de formato
npm run db:test    # migraciones + test de aislamiento en un Postgres local (PGlite); no toca la base remota
```

No hay tests de interfaz. La verificación es `typecheck` + `lint` + `build`; si tocaste `supabase/`, también `npm run db:test` (tarda unos segundos y es lo que corre el CI).

## Gotchas verificados

- `typecheck`/`build` usan `tsc -p tsconfig.app.json`; `lint` y `prettier` sólo cubren `src/**/*.{ts,tsx}`. `netlify/` y `vite.config.ts` quedan fuera del lint.
- Lint: `no-console` y `no-explicit-any` son **error**; `consistent-type-imports` es warn (usá `import type`). Prefijo `_` para variables/args intencionalmente sin usar.
- Node 24 (`.nvmrc`). Windows/PowerShell: no uses sintaxis bash en `shell`.
- El CRM usa rutas en el **hash** (`#/clientes/12`); listado, alta y detalle comparten página y se abren como modal con URL propia.
- Landings: se sirven en un host distinto del CRM. `netlify/edge-functions/landing.ts` (prod) y el plugin `landings-locales` de `vite.config.ts` (dev, `127.0.0.1:5173`) usan el mismo código de `src/components/crm/landings/pagina/`; `vite.config.ts` importa de `src/`, así que cambios ahí afectan al config.
- El recurso se llama `actividades` en código/base, pero en la UI son «Tareas».
- Permisos reales viven en la base (RLS + `tiene_modulo()`); la UI sólo oculta lo que la base rechazaría.
- `npm run db:push` aplica migraciones a la base **remota** con `psql` (lee `.env.scripts`, gitignoreado). `npm run db:psql -- -c "..."` también pega contra remoto. No los corras sin pedido explícito.
- Test de aislamiento (no automatizado): `npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento_cuentas.sql`.
- Secretos locales ignorados por git: `.env.local`, `.env.scripts`, `CREDENCIALES.md`. `opencode.json` pide confirmación para leer `.env*` y para `git push`.
- Más contexto de producto/permisos: `LEEME.md`; despliegue: `DESPLIEGUE.md`.

## Mapa del código

```
src/components/ui/            primitivas shadcn (no editar sin motivo)
src/components/admin/         piezas de shadcn-admin-kit (layout, tablas, inputs)
src/components/crm/
  root/                       CRM.tsx (rutas y recursos), config.ts
  layout/                     AppSidebar, Layout
  domain/                     types.ts, options.ts (labels), format.ts (ARS/es-AR), modulos.ts
  providers/                  authProvider, dataProvider, i18nProvider
  shared/                     CrmList, badges (Pill), ListControls, RecordForm, diálogos
  dashboard/                  Indicadores, gráficos, periodos
  clientes/ oportunidades/ actividades/ productos/ canales/ ventas/
  landings/ etiquetas/ usuarios/ cuentas/ auditoria/
supabase/                     migraciones y Edge Functions (NO tocar sin pedido explícito)
scripts/                      db.mjs, db-test.mjs (PGlite), crear-admin.mjs
```

## Convenciones

- **Rutas**: alias `@/*` → `src/*`. Imports relativos sólo entre archivos hermanos.
- **Nombres**: archivos y componentes en PascalCase; hooks `useAlgo`; dominio en español (`Cliente`, `Oportunidad`, `Etapa`). Evitá `any`.
- **Estilos**: sólo tokens (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-success/15`, `rounded-lg`). Sin hex sueltos ni `style` inline salvo cálculo.
- **Listados**: usá `CrmList` (tabla en escritorio, tarjetas en móvil, skeletons, vacío). No reimplementes tablas.
- **Estados**: reutilizá `Pill` y los badges de `shared/badges.tsx` (`EstadoClienteBadge`, `ResultadoBadge`, etc.).
- **Formato**: `formatMoneda`, `formatFecha`, `formatNumero`, `plural` de `domain/format.ts`. Nunca `toLocaleString` ad hoc.
- **Permisos**: `useModulos()` / `useCrmIdentity()` para mostrar u ocultar módulos.
- **Formularios**: `RecordForm` y `SeccionFormulario`; errores en español; validación con Zod cuando ya exista.
- **Accesibilidad**: `aria-label` en botones de sólo icono, foco visible, contraste, targets ≥ 40px.
- **Responsive**: 375 / 768 / 1440. Prohibido el scroll horizontal.
- **Código muerto**: no dejes imports ni variables sin usar (rompen el build).

## Reglas duras

1. No agregues dependencias sin autorización.
2. No toques `supabase/`, migraciones, `.env*` ni `ROADMAP.md` salvo pedido explícito.
3. No inventes helpers, props ni endpoints: verificá en el repo o en `node_modules`.
4. No cambies copy en español por inglés ni la moneda (ARS).
5. No commitees ni hagas `push` sin que lo pidan.
6. **Cuentas (multi-cliente)**: toda tabla de negocio nueva lleva `cuenta_id`, el trigger `trg_00_cuenta_sellar` y la política restrictiva `aislar_cuenta` (copiá el patrón de `supabase/migrations/20261114100000_cuentas.sql`). Toda función `security definer` que lea o escriba datos de negocio filtra por cuenta. Un módulo nuevo se suma en `usuarios_modulos_validos`, `cuentas_modulos_validos` (y su default), las Edge Functions `users` y `cuentas` y `domain/modulos.ts`. Después, correr `npm run db:test` (local) y, con la migración ya aplicada, el mismo `supabase/tests/aislamiento_cuentas.sql` contra la base real: `npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento_cuentas.sql`.
7. **Funciones SQL nuevas nacen cerradas** (migración `20261118100000`): sólo las ejecutan su dueño y `service_role`. Si la app o las políticas la usan, dale un `grant execute` explícito a quien corresponda, nunca a `public`. `anon` sólo ejecuta `landing_publica`, `landing_recibir`, `landing_productos` y `landing_pedido`; la sección 6 del test de aislamiento falla si algo más queda abierto.
8. **Landings públicas**: la lógica de negocio está en `privado.landing_recibir_base` y `privado.landing_pedido_base`. `public.landing_recibir` y `public.landing_pedido` sólo aplican topes contra abuso y delegan: editá la `_base`; un `create or replace` sobre la de `public` pisaría los topes.

## Seguridad: lo que ya está resuelto y no hay que romper

- **CSV**: toda celda se escribe con `celdaCsv` de `src/components/crm/shared/csv.ts` (neutraliza fórmulas de Excel; los nombres de clientes pueden venir de un formulario público). No armes CSV a mano.
- **Contraseñas provisorias**: las Edge Functions `users` y `cuentas` marcan `usuarios.debe_cambiar_clave`; el CRM bloquea con `layout/CambioClaveObligatorio.tsx` hasta que la persona elige una propia (RPC `clave_cambiada`). La marca no se escribe desde el cliente.
- **Plataforma (dueño del sistema)**: `cuentas` exige verificación en dos pasos (`aal2`) apenas el dueño activa TOTP; con la variable `MFA_PLATAFORMA=exigir` en la función lo exige siempre. UI: `layout/SeccionDosPasos.tsx` y `cuentas/ConfirmarDosPasos.tsx`; lógica: `providers/mfa.ts`.
- **Asistente de IA**: cupo por persona y por cuenta con la RPC `asistente_consumir`; los datos de clientes llegan acotados al modelo.
- **Orden de despliegue**: primero `npm run db:push`, después las Edge Functions (`users`, `cuentas`) y el sitio de Netlify. La CSP completa del CRM está en `netlify.toml` en modo prueba (`Report-Only`); no la pases a bloqueo sin revisar la vista previa de landings (ver el comentario ahí).
- `supabase/functions/**` y `netlify/functions/**` no entran en `typecheck` ni `lint`: revisalas a mano.

## Definition of Done

Una tarea de maquetación está terminada cuando:

- [ ] `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores.
- [ ] Se ve bien en 375, 768 y 1440 px, sin desbordes ni texto cortado.
- [ ] Tiene estados de carga, vacío y error.
- [ ] Usa el design system existente (tokens, `CrmList`, badges, `format.ts`).
- [ ] `revisor-ui` no reporta hallazgos de severidad alta ni media.

## Equipo de agentes

| Agente | Rol |
|---|---|
| `orquestador` | Planifica, delega, itera y cierra. No da por terminado sin QA en verde. |
| `maquetador` | Escribe y modifica UI. |
| `revisor-ui` | Sólo lectura: hallazgos por severidad. |
| `qa` | Ejecuta typecheck/lint/build y reporta errores literales. |

Comando: `/maquetar <objetivo>`.

## Entorno local

`npm run dev` necesita `.env.local` con `VITE_SUPABASE_URL`, `VITE_SB_PUBLISHABLE_KEY` y `VITE_LANDINGS_URL`. Si no existe, no hay verificación visual ni datos: sólo se puede validar `typecheck` + `lint` + `build`, y hay que decirlo explícitamente.

El servidor de desarrollo escucha sólo en `127.0.0.1` (apunta a la base real). Para probar desde el celular en la red local: `DEV_ABRIR_A_LA_RED=1` en `.env.local`. `compartir.bat` expone el CRM real por un túnel: pide el email de quien entra.
