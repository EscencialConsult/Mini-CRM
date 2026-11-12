# Despliegue — Mini-CRM y landings

Guía para poner el CRM y sus landings en internet **desde cero**. Está escrita
para que la pueda seguir alguien que nunca desplegó nada: cada paso explica qué
hacemos, por qué, y cómo saber si salió bien.

Si algo no coincide con lo que ves en pantalla, es porque las consolas de Netlify
y Supabase cambian de nombre a las opciones cada tanto: buscá la opción por su
descripción, no por su ubicación exacta.

---

## Índice

1. [Qué vamos a poner en línea](#1-qué-vamos-a-poner-en-línea)
2. [Cómo queda todo](#2-cómo-queda-todo)
3. [Antes de empezar](#3-antes-de-empezar)
4. [Paso 1 — El código en GitHub](#paso-1--el-código-en-github)
5. [Paso 2 — Crear el sitio en Netlify](#paso-2--crear-el-sitio-en-netlify)
6. [Paso 3 — Las variables de entorno](#paso-3--las-variables-de-entorno)
7. [Paso 4 — El dominio y el DNS](#paso-4--el-dominio-y-el-dns)
8. [Paso 5 — La función que sirve las landings](#paso-5--la-función-que-sirve-las-landings)
9. [Paso 6 — La base de datos](#paso-6--la-base-de-datos)
10. [Paso 7 — La función de usuarios](#paso-7--la-función-de-usuarios)
11. [Paso 8 — El login de Supabase](#paso-8--el-login-de-supabase)
12. [Paso 9 — Verificación](#paso-9--verificación)
13. [Cómo se actualiza el sitio](#cómo-se-actualiza-el-sitio)
14. [Cuánto cuesta y qué límites tiene](#cuánto-cuesta-y-qué-límites-tiene)
15. [Problemas frecuentes](#problemas-frecuentes)
16. [Alternativas a Netlify](#alternativas-a-netlify)
17. [Secretos y seguridad](#secretos-y-seguridad)

---

## 1. Qué vamos a poner en línea

Dos cosas distintas, que viven en el mismo lugar pero se ven en dos direcciones
web separadas:

- **El CRM**: la aplicación privada donde trabaja el equipo (clientes,
  oportunidades, pedidos, landings, etc.). Solo entra quien tiene usuario.
- **Las landings**: las páginas públicas que el equipo crea desde el CRM para
  captar clientes o vender productos. Las ve cualquiera, sin login.

### Palabras que van a aparecer

| Palabra | Qué es, en criollo |
|---|---|
| **Frontend** | Lo que se ve y se toca en el navegador. Acá es el CRM y también el HTML de las landings. |
| **Backend** | Lo que corre del lado del servidor: guardar datos, validar, mandar mails. Acá lo hace Supabase. |
| **Supabase** | El servicio que nos da la base de datos (PostgreSQL), el login de usuarios, el guardado de archivos y las funciones de servidor. |
| **Netlify** | El servicio que hospeda la web: guarda los archivos y los entrega a quien los pida. |
| **Edge Function** | Un pedacito de código que corre *en Netlify*, muy cerca del visitante, antes de entregar una página. Acá lo usamos para armar las landings al vuelo. |
| **Dominio** | El nombre del sitio, por ejemplo `midominio.com`. Se alquila por año. |
| **DNS** | La "agenda telefónica" de internet: traduce `crm.midominio.com` a la dirección real del servidor. |
| **Subdominio** | Lo que va antes del dominio: en `crm.midominio.com`, el subdominio es `crm`. |
| **Deploy** | Publicar una versión nueva del sitio. Cada vez que cambia el código, se hace un deploy. |
| **Variable de entorno** | Un dato de configuración (una URL, una clave) que se guarda en Netlify, no en el código. |
| **Build** | El paso de "armar" el sitio: toma el código fuente y genera los archivos finales. |

---

## 2. Cómo queda todo

```
                       ┌─────────────── Supabase (una sola base) ───────────────┐
                       │  Base de datos · Login · Archivos · Función «users»    │
                       └────────────────────────────────────────────────────────┘
                                  ▲                              ▲
                                  │                              │
   crm.midominio.com ─────────────┘                              └────── paginas.midominio.com
   (dominio primario)                                                   (alias de dominio)
   → sirve el CRM (archivos)                                            → sirve las landings (Edge Function)
```

Un **único sitio en Netlify**, con **dos direcciones** apuntándole:

| Dirección | Qué muestra | Cómo lo sirve |
|---|---|---|
| `crm.midominio.com` | El CRM | Los archivos ya compilados (carpeta `dist/`). |
| `paginas.midominio.com` | Las landings publicadas | La Edge Function `netlify/edge-functions/landing.ts`. |

**¿Por qué dos direcciones y no una?** Por seguridad y por privacidad. Una landing
y su sesión de CRM no deben compartir origen: así las cookies de la sesión, los
píxeles de publicidad y los datos del CRM nunca se mezclan con lo que ve un
visitante anónimo.

**¿Por qué un solo sitio en Netlify y no dos?** Porque la Edge Function mira la
dirección que se pidió: si es la de las landings, arma la página; si es cualquier
otra (el CRM incluido), deja pasar los archivos normales. Un solo sitio = un solo
build, una sola configuración.

---

## 3. Antes de empezar

Necesitás tener:

- [ ] **Node 24** instalado en tu computadora (`node --version` debe empezar con `v24`).
      El proyecto tiene un archivo `.nvmrc` que lo pide.
- [ ] Una cuenta de **GitHub** con acceso al repositorio del proyecto.
- [ ] Una cuenta de **Netlify** (se crea gratis en <https://app.netlify.com/signup>,
      conviene entrar con GitHub).
- [ ] Acceso al proyecto de **Supabase** (panel en <https://supabase.com/dashboard>).
- [ ] Un **dominio propio** (por ejemplo `midominio.com`), comprado en cualquier
      registrador (Namecheap, Cloudflare, DonWeb, etc.).

> **¿Todavía no tenés dominio?** Podés hacer todo igual y probar con dos sitios
> de Netlify (ver el recuadro del [Paso 4](#paso-4--el-dominio-y-el-dns)).

---

## Paso 1 — El código en GitHub

Netlify va a leer el código desde GitHub. Todo lo que esté subido ahí es lo que se
va a publicar.

```bash
# Ubicate en la carpeta del proyecto y comprobá que compila antes de subir
npm install
npm run typecheck && npm run lint && npm run build
```

Si el build termina bien, subí los cambios:

```bash
git status            # revisá qué se va a subir
git add -A
git commit -m "Descripción corta de lo que cambió"
git push
```

> **Ojo con lo que se sube.** El archivo `.gitignore` ya excluye los secretos
> (`.env.local`, `.env.scripts`, `CREDENCIALES.md`) y las transcripciones de
> trabajo (`session-*.md`, `.opencode/`, `opencode.json`). **Nunca** subas claves
> privadas ni contraseñas: si se suben, quedan en el historial de GitHub para
> siempre.

**Cómo saber si salió bien:** en GitHub, la página del repositorio muestra el
commit nuevo con la fecha de hace un minuto.

---

## Paso 2 — Crear el sitio en Netlify

1. Entrá a <https://app.netlify.com>.
2. **Add new project** (o *Add new site*) → **Import an existing project**.
3. Elegí **GitHub** y autorizá el acceso si te lo pide.
4. Seleccioná el repositorio del CRM.
5. En la pantalla de configuración:
   - **Branch to deploy**: `main`.
   - **Build command** y **Publish directory**: **no los toques**. Netlify los lee
     del archivo `netlify.toml` que está en el repositorio:
     ```toml
     [build]
       command = "npm run build"
       publish = "dist"
     [build.environment]
       NODE_VERSION = "24"
     ```
   - Si Netlify igual te muestra campos vacíos o con otro valor, escribí
     `npm run build` y `dist` a mano. El número de Node debe ser `24`.
6. **Deploy**.

Netlify va a instalar dependencias, compilar el sitio y publicarlo. Tarda un par
de minutos. Al terminar, te da una dirección tipo `nombre-random-123.netlify.app`.

**Cómo saber si salió bien:** entrás a esa dirección y ves la pantalla de login
del CRM. (El login todavía puede fallar: falta el [Paso 3](#paso-3--las-variables-de-entorno).)

---

## Paso 3 — Las variables de entorno

Son los datos que el CRM necesita para conectarse a Supabase. Se cargan en Netlify,
no en el código.

1. En Netlify: **Project configuration** → **Environment variables**.
2. Agregá estas tres (una por una, con **Add a variable** → *Create a new variable*):

| Nombre | Valor | De dónde sale |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → **Project Settings → API** → *Project URL*. |
| `VITE_SB_PUBLISHABLE_KEY` | `sb_publishable_...` | Supabase → **Project Settings → API** → *Publishable key*. |
| `VITE_LANDINGS_URL` | `https://paginas.midominio.com` | Lo decidís vos: es la dirección donde van a vivir las landings. |

3. Para cada variable, en **Scopes** (alcances) dejá seleccionado **All**, o como
   mínimo **Builds** y **Functions**. Esto es importante: las tres se usan en dos
   momentos distintos y necesitan estar disponibles en los dos.

### Cosas importantes sobre estas variables

- **Son públicas a propósito.** La *Publishable key* de Supabase está pensada para
  ir en el navegador: la seguridad real la da la base (RLS). Lo que **nunca** va
  acá es la *Secret key* ni la contraseña de la base.
- **`VITE_LANDINGS_URL` se graba durante el build.** Queda metida dentro de los
  archivos compilados. Si la cambiás, hay que **volver a hacer un deploy** para
  que tome efecto (no alcanza con guardarla).
- **Las landings se sirven solo en esa dirección exacta.** Tiene que ser un host
  distinto del CRM (`paginas.…`, no `crm.…`).
- Después de cargar las variables, andá a **Deploys** → **Trigger deploy** →
  *Deploy site*, para que el build las tome.

**Cómo saber si salió bien:** volvés a la dirección de Netlify y ahora el login del
CRM funciona.

---

## Paso 4 — El dominio y el DNS

Un dominio es un nombre alquilado. El DNS es la agenda que dice a dónde va cada
nombre.

### 4.1. Agregar los dominios en Netlify

1. En Netlify: **Domain management** → **Production domains**.
2. **Add a domain** → escribí `crm.midominio.com` (reemplazá `midominio.com` por
   tu dominio real) → confirmá. Netlify te va a pedir que configures el DNS.
3. Repetí para agregar `paginas.midominio.com` usando **Add domain alias**.
4. Asegurate de que el **primary domain** (dominio primario) sea `crm.midominio.com`.
   Si no lo es, usá el botón **Options** → *Set as primary domain*.

### 4.2. Configurar el DNS en tu registrador

En el panel del lugar donde compraste el dominio, creá **dos registros CNAME**:

| Tipo | Nombre / Host | Valor / Destino | TTL |
|---|---|---|---|
| CNAME | `crm` | `nombre-de-tu-sitio.netlify.app` | Automático |
| CNAME | `paginas` | `nombre-de-tu-sitio.netlify.app` | Automático |

- El **nombre** es solo la parte de adelante (`crm`, `paginas`), no el dominio entero.
- El **valor** es la dirección `.netlify.app` que te dio Netlify al crear el sitio.

> Si tu registrador no deja poner CNAMEs y preferís no pelear con eso, podés
> delegar el DNS completo a Netlify (**Domain management** → *Set up Netlify DNS*
> y cambiar los *nameservers* en tu registrador). Es más simple de mantener.

### 4.3. HTTPS

Netlify emite el certificado HTTPS (Let's Encrypt) **automáticamente** cuando el
DNS apunta bien. Puede tardar unos minutos. En **Domain management** cada dominio
debe mostrar **HTTPS: activo**.

> ### Probar sin dominio propio
> Si todavía no tenés dominio, podés validar el circuito completo con dos sitios
> de Netlify: creás un segundo sitio importando el **mismo** repositorio, y ponés
> su dirección en `VITE_LANDINGS_URL` (`https://tu-segundo-sitio.netlify.app`).
> Así las landings quedan en un host distinto del CRM sin comprar nada. Cuando
> tengas dominio, cambiás esa variable por `https://paginas.midominio.com` y
> volvés a deployar.

**Cómo saber si salió bien:** `https://crm.midominio.com` abre el CRM con candado
(HTTPS) y **sin** redirigir a otra dirección.

---

## Paso 5 — La función que sirve las landings

Acá está la magia: una **Edge Function** que arma la landing en el momento en que
alguien la pide.

**No hay que hacer nada para instalarla.** Netlify detecta automáticamente la
carpeta `netlify/edge-functions/` del repositorio y despliega su contenido en cada
build. El archivo es `netlify/edge-functions/landing.ts`.

Qué hace, en orden:

1. Mira qué dirección se pidió. Si **no** es la de `VITE_LANDINGS_URL`, deja pasar
   los archivos normales (así el CRM no se ve afectado).
2. Si es la de las landings, interpreta la ruta:
   - `/<dirección-de-la-landing>` → la página de la landing.
   - `/<dirección-de-la-landing>/privacidad` → su política de privacidad.
3. Le pide a Supabase el contenido publicado (`landing_publica`) y arma el HTML.
4. Si la dirección no existe o no está publicada, muestra una página de "no
   disponible" (nunca un error crudo).
5. Guarda la respuesta en el caché de Netlify, para no golpear la base en cada visita.

### Reglas de las direcciones (slug)

La dirección de una landing la genera el CRM a partir del nombre. Reglas:

- Solo minúsculas, números y guiones: `formacion-en-rrhh`.
- No puede empezar ni terminar con guion, ni tener más de 63 caracteres.
- No puede ser una palabra reservada: `crm`, `www`, `mail`, `api`, `admin`, `app`,
  `smtp`, `ftp`, `webmail`, `ns1`, `ns2`, `bounce`.
- Una landing publicada responde en una sola dirección: `/<slug>` (con o sin barra
  final, y sin mayúsculas).

**Cómo saber si salió bien:** en Netlify, **Functions** (o **Project configuration
→ Functions**) → debe aparecer la función **`landing`** con la ruta `/*`.

> Si en cambio ves un 404 en `https://paginas.midominio.com/<slug>`, revisá que
> la landing esté **publicada** en el CRM y que `VITE_LANDINGS_URL` coincida
> exactamente con ese host.

---

## Paso 6 — La base de datos

La base ya existe (proyecto de Supabase `dzabqnznnotkztrdextl`) y tiene aplicadas
todas las migraciones. **Si vas a usar ese mismo proyecto, no hay nada que hacer
en este paso.**

Si en cambio creás un proyecto de Supabase **nuevo** (por ejemplo, para separar
producción de pruebas), hay que aplicarle las migraciones.

### 6.1. Preparar las credenciales de los scripts

Creá un archivo `.env.scripts` en la raíz del proyecto (está ignorado por git, así
que nunca se sube). Necesita estas seis claves:

```dotenv
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_DB_HOST=db.<ref>.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=<la contraseña de la base>
SUPABASE_SECRET_KEY=<la secret key del proyecto>
```

- La contraseña de la base la elegís al crear el proyecto (Supabase → **Project
  Settings → Database**).
- La *secret key* está en **Project Settings → API**.
- Requiere tener `psql` (el cliente de PostgreSQL) instalado.

### 6.2. Aplicar las migraciones

```bash
npm run db:push
```

Esto aplica todas las migraciones de `supabase/migrations/` y las registra, así la
próxima vez solo corre las nuevas. Podés comprobar que la base responde:

```bash
npm run db:psql -- -c "select count(*) from clientes"
```

### 6.3. Crear el primer administrador

Sin al menos un administrador, nadie puede entrar ni crear usuarios:

```bash
npm run admin:crear -- correo@dominio.com Nombre Apellido [clave] [administrador|vendedor]
```

Si no le pasás clave, te la pide el script.

### 6.4. (Opcional) Datos de prueba

Solo para un entorno de prueba, nunca en producción con datos reales:

```bash
npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/seed/datos_prueba.sql
npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/seed/etiquetas_prueba.sql
```

**Cómo saber si salió bien:** `npm run db:push` termina con "Base al día" (o aplica
las pendientes sin errores) y podés loguearte al CRM con el administrador que creaste.

---

## Paso 7 — La función de usuarios

El CRM crea usuarios, cambia roles, desactiva cuentas y restablece claves a través
de una **Edge Function de Supabase** llamada `users`. Esa función hay que desplegarla
aparte (no se despliega sola).

1. Generá un **Personal Access Token** de Supabase:
   <https://supabase.com/dashboard/account/tokens> → *Generate new token*.
2. En la terminal, dentro del proyecto:

```bash
# Windows (PowerShell)
$env:SUPABASE_ACCESS_TOKEN = "sbp_tu_token"
# macOS / Linux (bash)
export SUPABASE_ACCESS_TOKEN=sbp_tu_token

npx supabase functions deploy users --use-api --project-ref dzabqnznnotkztrdextl --yes
```

> El token (`sbp_...`) es **personal y secreto**: no lo pegues en el código, ni en
> Netlify, ni en un chat. Si se filtra, borralo y generá otro.

**Cómo saber si salió bien:** en el CRM, entrá a **Usuarios** y creá uno de prueba.
Si aparece en la lista, la función está funcionando.

---

## Paso 8 — El login de Supabase

Ajustes para que el login funcione solo desde tu dominio y nadie pueda auto-registrarse.

### 8.1. Cerrar el registro público

Los usuarios los crea un administrador; nadie debería poder registrarse solo.

Supabase → **Authentication** → **Sign In / Providers** → **Email** → desactivá
**Enable sign up** (permitir registro) → guardá.

Alternativa por consola (con el token del Paso 7):

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/dzabqnznnotkztrdextl/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disable_signup": true}'
```

### 8.2. Direcciones permitidas

Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: `https://crm.midominio.com`
- **Redirect URLs**: agregá
  - `https://crm.midominio.com/**`
  - `http://localhost:5173/**` (para desarrollo en tu computadora)

> Aunque el registro esté abierto, un usuario sin fila en la tabla `usuarios` no
> puede leer ni escribir nada: lo impide la seguridad de la base (RLS). Estos
> ajustes son una capa extra.

**Cómo saber si salió bien:** te deslogueás y volvés a entrar; el navegador te
mantiene la sesión en `https://crm.midominio.com`.

---

## Paso 9 — Verificación

Recorré esta lista de arriba a abajo. Si algo falla, mirá
[Problemas frecuentes](#problemas-frecuentes).

- [ ] `https://crm.midominio.com` abre el CRM, con HTTPS y sin redirecciones raras.
- [ ] Podés iniciar sesión y la sesión persiste al recargar la página.
- [ ] Al recargar en una pantalla interna (por ejemplo `#/clientes`) **no** da 404.
- [ ] En **Usuarios** podés crear un usuario nuevo.
- [ ] En **Landings**, creás una y la **publicás**.
- [ ] `https://paginas.midominio.com/<slug>` muestra la landing publicada
      (no el CRM, no una redirección al CRM).
- [ ] `https://paginas.midominio.com/<slug>/privacidad` muestra la política.
- [ ] En una landing con carrito: agregás un producto, completás el formulario y
      enviás. Aparece el número de pedido.
- [ ] Ese pedido aparece en el CRM, en **Pedidos**.
- [ ] El cliente nuevo aparece en **Clientes**, con canal de origen **Landing**.
- [ ] En **Resultados** de la landing se registran la visita y el contacto.
- [ ] Abriendo el sitio en el celular, se ve bien (no hay scroll horizontal).

---

## Cómo se actualiza el sitio

Cada `git push` a la rama `main` dispara un **deploy automático** en Netlify:

```bash
npm run typecheck && npm run lint && npm run build   # verificá antes
git add -A
git commit -m "Lo que cambió"
git push
```

Netlify compila y publica en unos minutos. En **Deploys** ves el historial y, si
algo sale mal, podés volver a una versión anterior con **Rollback** (es instantáneo
y no gasta créditos).

**Deploy Previews**: si trabajás con pull requests, Netlify arma una copia de
prueba con su propia dirección para revisar antes de publicar. Son **gratis** (no
consumen créditos).

### Cambiar el contenido de una landing

Esto **no** requiere deploy: las landings se editan y se publican **desde el CRM**.
Al publicar, el cambio se ve al instante en `https://paginas.midominio.com/<slug>`.

---

## Cuánto cuesta y qué límites tiene

Los dos servicios tienen plan gratuito. Los números cambian con el tiempo: si algo
no coincide, vale lo que diga la página de precios oficial.

### Netlify

El plan **Free** da **300 créditos por mes** y es un **límite duro**: si se agotan,
los sitios se **pausan** (los visitantes ven "Site not available") hasta el mes
siguiente o hasta comprar créditos.

| Consumo | Costo en créditos | Con 300 créditos alcanza para |
|---|---|---|
| Deploy a producción | 15 c/u | ~20 deploys |
| Tráfico (bandwidth) | 20 por GB | 15 GB |
| Visitas (web requests) | 2 por 10.000 | 1.500.000 pedidos |
| Deploy previews / branch deploys | 0 | ilimitados |
| Edge Functions | se cuentan como visitas | — |

> **Atención con los deploys.** Si deployás todos los días, 30 deploys = 450
> créditos: te pasás del plan gratis sin haber tenido una sola visita. Un uso
> tranquilo (pocos deploys por mes) entra cómodo en Free.

Plan **Personal**: ~US$ 9/mes, 1.000 créditos.

### Supabase

Plan **Free**: 500 MB de base, 5 GB de transferencia, 1 GB de archivos, 50.000
usuarios activos, 500.000 llamadas a funciones.

Dos cosas a tener muy en cuenta:

- **Los proyectos Free se pausan tras una semana sin actividad.** Si nadie entra
  al CRM durante 7 días, se pausa y hay que reactivarlo a mano desde el panel.
- **No tiene copias de seguridad automáticas.**

Plan **Pro**: desde US$ 25/mes. No se pausa nunca y hace copias diarias.

### Recomendación

| Escenario | Stack | Costo |
|---|---|---|
| Prueba / demo | Netlify Free + Supabase Free | US$ 0 |
| Producción chica, en uso real | Netlify Personal + Supabase Pro | ~US$ 34/mes |

Si es un CRM con datos de clientes de verdad, **lo primero que conviene pagar es
Supabase Pro**: evita las pausas y te da copias de seguridad.

---

## Problemas frecuentes

**El sitio se ve, pero el login no funciona o dice error de conexión.**
Faltan o están mal las variables de entorno. Revisá el [Paso 3](#paso-3--las-variables-de-entorno)
y volvé a deployar (*Deploys → Trigger deploy*).

**`https://paginas.midominio.com/<slug>` muestra el CRM o da 404.**
- El CRM y las landings **no pueden** compartir host: revisá que `VITE_LANDINGS_URL`
  sea `https://paginas.…` y no `https://crm.…`.
- Si redirige al CRM, borrá cualquier *domain redirect* que se haya agregado de más.
- Confirmá que la landing esté **publicada**.

**Cambié `VITE_LANDINGS_URL` y no pasa nada.**
Es una variable que se graba durante el build: hay que **volver a deployar** para
que tome efecto.

**Las landings se ven, pero los productos del carrito no cargan.**
Suele ser que la landing publicada quedó sin el bloque de carrito. Entrá al CRM,
abrí la landing y **volvé a publicarla** con el carrito activado.

**Netlify dice "Site not available" o "This site has been suspended".**
Se agotaron los 300 créditos del plan Free. Mirá **Usage** en Netlify y esperá al
mes siguiente o pasate a Personal.

**Supabase dice que el proyecto está pausado.**
El plan Free pausa los proyectos sin actividad. Entrá al panel de Supabase y
**Restore / Resume** el proyecto.

**El build falla en Netlify pero en mi computadora anda.**
Casi siempre es la versión de Node. Verificá que `NODE_VERSION = "24"` esté en
`netlify.toml` (ya está) y que el error del log no sea un `typecheck` que falla.
Corré `npm run typecheck && npm run lint && npm run build` localmente antes de subir.

**Los links de las landings redirigen a otra dirección.**
Hay una *domain redirect* de más en **Domain management**. Borrala: los alias de
dominio sirven el contenido, no redirigen.

---

## Alternativas a Netlify

| Plataforma | Veredicto para este proyecto |
|---|---|
| **Netlify** | **Recomendada.** El repositorio ya está escrito para ella: `netlify.toml` y la Edge Function de las landings. No hay nada que programar. |
| **Vercel** | Muy buena para el CRM, pero las landings habría que reescribirlas (la función usa la API de Netlify). Trabajo extra sin beneficio. |
| **Cloudflare Pages / Workers** | Igual: habría que reescribir la función. Además requiere plan pago para la misma flexibilidad. |
| **Un servidor propio (VPS / cPanel)** | Más trabajo: sin CDN, con HTTPS y actualizaciones a mano. Peor para una PyME. |

---

## Secretos y seguridad

Reglas de oro:

1. **Nunca** subas al repositorio: `.env.local`, `.env.scripts`, `CREDENCIALES.md`,
   contraseñas, tokens `sbp_...`, la *secret key* de Supabase. El `.gitignore` ya
   los excluye, pero revisá con `git status` antes de cada `git add`.
2. **En Netlify** van solo las tres variables `VITE_*` del Paso 3, que son públicas.
   La *secret key* y la contraseña de la base **no** van ahí.
3. El **Personal Access Token** de Supabase se usa solo para desplegar la función de
   usuarios y para administrar la base. Si se filtra, borralo y generá otro.
4. Si alguna clave se pegó en un chat, un correo o un documento, **rotala**
   (generá una nueva y desechá la vieja).
5. La seguridad de los datos la da la base (RLS): aunque la *publishable key* sea
   pública, un usuario sin permiso no puede leer ni escribir nada.

---

## Referencias rápidas

- Repositorio: `https://github.com/EscencialConsult/Mini-CRM`
- Panel de Netlify: <https://app.netlify.com>
- Panel de Supabase: <https://supabase.com/dashboard/project/dzabqnznnotkztrdextl>
- Tokens de Supabase: <https://supabase.com/dashboard/account/tokens>
- Precios de Netlify: <https://www.netlify.com/pricing/>
- Precios de Supabase: <https://supabase.com/pricing>
