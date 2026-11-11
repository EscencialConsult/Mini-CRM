# Mini-CRM

Versión reducida del CRM Escencial, con el mismo diseño y stack: **React 19 + TypeScript + Vite**, **shadcn-admin-kit (ra-core)**, **Tailwind v4** y **Supabase** (PostgreSQL, Auth, RLS y Edge Functions).

## Módulos

| Módulo | Qué incluye |
|---|---|
| **Clientes** | Alta, edición y baja. Persona (nombre y apellido) o empresa (razón social). CUIT/DNI validado (dígito verificador del CUIT), teléfono, email, dirección, estado activo/inactivo, vendedor asignado y próximo contacto. |
| **Oportunidades** | Producto o servicio de interés, importe estimado, etapa de negociación (Prospecto → Calificado → Propuesta → Negociación), probabilidad de cierre (se sugiere por etapa) y resultado ganada/perdida con motivo. Se ven en un **Tablero** (una columna por etapa con las abiertas; arrastrar una tarjeta le cambia la etapa) o en el **Listado** con todas. |
| **Actividades** | Llamadas, reuniones, notas y tareas; se registran como realizadas o se programan. Responsable, vencimiento y vínculo opcional a una oportunidad del cliente. |
| **Panel de control** | Total y nuevos clientes, oportunidades abiertas (importe y ponderado), ventas ganadas y perdidas del período, actividades pendientes, resumen de ventas por mes, embudo por etapa y seguimiento propio o de todo el equipo. |
| **Usuarios y permisos** | Inicio de sesión, roles administrador y vendedor, alta de usuarios por el administrador, asignación de clientes, perfil propio y **auditoría** de quién hizo cada acción. |
| **Landings** | Páginas públicas con formulario, editadas en el lugar a partir de una plantilla (textos, secciones, preguntas, diseño, botón de WhatsApp, píxeles, privacidad y enlaces de campaña). Cada envío crea (o reconoce, por email o teléfono) un **cliente asignado al administrador**, una nota con las respuestas, el consentimiento y la campaña, y una **tarea** de seguimiento. Resultados por landing: visitas, envíos, clientes nuevos, conversión, ventas, origen y campaña. |

Recordatorios de seguimiento: campana en el menú y bloque “Seguimiento” del panel (tareas y contactos vencidos o de hoy). Solo dentro de la app.

## Permisos

| Acción | Administrador | Vendedor |
|---|---|---|
| Ver y editar clientes, oportunidades y actividades | Todo | Todo |
| Crear clientes | Los asigna a quien quiera | Quedan asignados a él |
| Reasignar clientes | Sí | No |
| Dar de baja (inactivar) un cliente | Sí | Sí |
| Eliminar cliente u oportunidad (borrado definitivo, con advertencia) | Sí | No |
| Eliminar una actividad | Cualquiera | Solo las que creó |
| Gestionar usuarios (alta, rol, desactivar, restablecer clave) | Sí | No |
| Ver auditoría e historial por cliente | Sí | No |
| Crear, editar, publicar y despublicar landings | Sí | Sí |
| Eliminar una landing (borrado definitivo; antes hay que despublicarla) | Sí | No |

Los permisos se aplican en la base (RLS + triggers); la interfaz solo oculta lo que la base rechazaría.

## Puesta en marcha

Requiere Node 24 (`.nvmrc`).

```bash
npm install
cp .env.example .env.local      # completar URL y publishable key (ver CREDENCIALES.md)
npm run dev                     # CRM en http://localhost:5173, landings en http://127.0.0.1:5173/<dirección>
```

Archivos locales con secretos, **ignorados por git**: `CREDENCIALES.md`, `.env.local` (claves públicas del frontend) y `.env.scripts` (clave de la base y secret key, solo para `scripts/`).

### Base de datos

Las migraciones están en `supabase/migrations/` (esquema, triggers de autoría y auditoría, RLS, vistas, funciones del panel y búsqueda). Se aplican con `psql` (no requiere Docker):

```bash
npm run db:push                                  # aplica las migraciones pendientes
npm run db:psql -- -c "select count(*) from clientes"
npm run admin:crear -- correo@dominio.com Nombre Apellido [clave] [administrador|vendedor]
```

La zona horaria de negocio es `America/Argentina/Buenos_Aires` (funciones del panel y recordatorios).

### Landings

Se publican por ruta: `<VITE_LANDINGS_URL>/<dirección>` y `<VITE_LANDINGS_URL>/<dirección>/privacidad`. `VITE_LANDINGS_URL` tiene que ser un host distinto del CRM (una landing y sus píxeles no comparten origen con la sesión).

- **Producción (Netlify):** `netlify/edge-functions/landing.ts` sirve las páginas en ese host y deja pasar cualquier otro. Pasos: un CNAME (por ejemplo `paginas`) al sitio, agregarlo como alias de dominio y definir `VITE_SUPABASE_URL`, `VITE_SB_PUBLISHABLE_KEY` y `VITE_LANDINGS_URL` en las variables del sitio.
- **Local:** el plugin `landings-locales` de `vite.config.ts` usa la misma función en `http://127.0.0.1:5173` (abrí el CRM en `localhost`).
- **Base:** `landing_publica` (lectura anónima de lo publicado, sin el seguimiento interno) y `landing_recibir` (visitas y envíos; campo trampa y límite de 5 envíos cada 10 minutos por IP, guardada solo como hash). Publicar y despublicar pasa por `landing_publicar` / `landing_despublicar`, que dejan registro en la auditoría; los cambios hechos por un visitante quedan con origen “Landing «…»”.
- **Reglas del alta:** el nombre completo se divide en nombre y apellido (última palabra); una persona puede quedar sin apellido. Un cliente nuevo queda asignado al administrador elegido en la landing (o al primer administrador activo); la tarea de un cliente que ya existía va a su vendedor si está activo.
- Imágenes: bucket público `landing-imagenes` (5 MB, solo imágenes).

### Edge Function `users` (alta y gestión de usuarios)

Crea usuarios, cambia roles, desactiva cuentas y restablece claves; solo responde a administradores activos. Para desplegarla hace falta un **Personal Access Token** de Supabase (<https://supabase.com/dashboard/account/tokens>):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx
npx supabase functions deploy users --use-api --project-ref dzabqnznnotkztrdextl --yes
```

Conviene además cerrar el registro público (los usuarios los crea un administrador):

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/dzabqnznnotkztrdextl/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"disable_signup": true}'
```

Aun con el registro abierto, un usuario sin fila en `usuarios` no puede leer ni escribir nada (RLS).

## Estructura

```
src/components/
  ui/ admin/            Componentes base (shadcn / shadcn-admin-kit), mismo diseño que el CRM Escencial
  crm/
    domain/             Tipos, opciones, formato (ARS, fechas) y validadores (CUIT/DNI)
    providers/          Data provider (Supabase), auth, permisos e i18n (español)
    shared/             Listado responsivo, modal de registro, formularios, borrado, errores globales
    clientes/ oportunidades/ actividades/ dashboard/ usuarios/ auditoria/
    landings/           Editor, listado y resultados; pagina/ arma el HTML público (también lo usa Netlify)
    layout/ login/ root/
supabase/
  migrations/           Esquema versionado
  functions/users/      Edge Function de usuarios
netlify/edge-functions/ landing.ts: sirve las landings publicadas
scripts/                db.mjs (migraciones), crear-admin.mjs
```

Convenciones: dominio y base en español (`clientes`, `oportunidades`, `actividades`, `usuarios`, `auditoria`, `landings`); el listado, el alta y el detalle de cada recurso comparten una misma página y se abren como modal con URL propia (`#/clientes/12`); los filtros del listado se guardan en el navegador.

## Calidad

```bash
npm run typecheck && npm run lint && npm run build
```

## Pendiente / extensiones posibles

- Desplegar la Edge Function `users` y cerrar el registro público (necesita el token).
- Publicar el sitio en Netlify con el alias de dominio de las landings y `VITE_LANDINGS_URL`.
- Recordatorios por email (requiere proveedor de envío y una tarea programada).
- Importación/exportación CSV y reasignación masiva de clientes.
