# Roadmap — módulos, productos, canales y ventas

Documento de trabajo para retomar en cualquier conversación. **Leelo entero antes de seguir.**
Las decisiones ya están tomadas con el usuario (2026-11-11 y 2026-11-12): no volver a preguntarlas.

## Estado general (2026-11-12)

| Fase | Qué | Estado |
|---|---|---|
| 1 | Módulos por usuario (permisos) | ✅ Hecha y desplegada (base + Edge Function) |
| 2 | Catálogo de productos + líneas en la oportunidad | ✅ Desplegada |
| 3 | Canales de venta | ✅ Desplegada |
| 4 | Cerrar oportunidades (ganada/perdida) desde el tablero | ✅ Desplegada |
| 5 | Sección Ventas (listado + reportes) | ✅ Desplegada |
| — | Mejorar la vista de Etiquetas | ✅ Hecha (solo frontend) |

**Desplegado el 2026-11-12**: las 3 migraciones aplicadas con `db:push` y la Edge Function `users`
actualizada (v3). Commit `a58adb4` en la rama `feat/productos-canales-ventas` (pusheada; falta
mergear a `main`). El frontend no está publicado: se usa en local con `npm run dev`.

**Falta:** probar en la app con un administrador y un vendedor (ver "Qué probar") y mergear la rama.

---

## Despliegue (hecho el 2026-11-12)

Las migraciones están en `supabase/pendientes/` **a propósito**, para que `db:push` no las aplique
antes de tiempo. Las tres van juntas y en orden:

1. `20261111210000_productos_y_canales.sql` (fases 2 y 3)
2. `20261112100000_motivos_de_perdida.sql` (fase 4)
3. `20261112110000_ventas.sql` (fase 5)

Pasos:
1. Moverlas a `supabase/migrations/` y borrar la carpeta `supabase/pendientes/`.
2. `npm run db:push`.
3. Desplegar la Edge Function `users` (suma `productos` y `ventas` a `MODULOS`): ver "Cómo trabajar".
4. `npm run dev` y probar con un administrador y con un vendedor (ver "Qué probar").
5. Commitear.

Las tres migraciones y el seed se probaron juntos contra la base real en una transacción con
rollback (2026-11-12): aplican sin errores y el seed carga 157 oportunidades (26 perdidas, todas
con motivo).

### Qué probar en la app
- **Productos** (menú Administración): alta, edición, desactivar/activar, borrar uno sin uso.
- **Canales** (solo administrador): igual; «Landing» no se puede borrar.
- **Oportunidad**: cargar 2 líneas (el precio se completa con el de lista), ver subtotal y total;
  el canal se completa con el del cliente; el título se arma solo al guardar.
- **Cliente**: «Canal de origen»; filtro y columna de canal en Clientes y en el Tablero/Listado.
- **Tablero**: arrastrar una tarjeta → aparecen Ganada/Perdida abajo; soltar abre el diálogo.
  Menú ⋯ de la tarjeta con lo mismo. Al confirmar, la tarjeta sale del tablero.
- **Ventas**: filtros (período, vendedor, canal, producto), reportes y listado; exportar CSV.
  Un vendedor con solo el módulo Ventas ve las cerradas pero no el Tablero.
- **Etiquetas**: renombrar tocando el nombre (Enter guarda, Esc cancela), color desde el punto,
  papelera con confirmación.
- **Auditoría**: los cambios de productos, canal y motivo se ven legibles.

---

## Fase 1 — Módulos por usuario ✅

**Decisiones**
- El administrador asigna módulos a cada usuario: Panel, Clientes, Tablero (`oportunidades`), Tareas (`actividades`), Productos, Ventas, Landings, Etiquetas, Auditoría.
- Permiso de sí o no por módulo (sin niveles ver/editar/borrar). Las reglas de borrado de siempre se mantienen.
- **Usuarios** y **Canales** no son módulos: siempre son solo del administrador. El administrador tiene todos los módulos.
- Sin el módulo: no aparece en el menú, la ruta escrita a mano lleva a "Acceso denegado" y la base rechaza sus datos.
- Dependencias: con Tablero o Tareas sin Clientes, se **leen** clientes (nombre, selector), pero no se editan ni se abre `/clientes`. Con Tablero sin Productos se eligen productos, pero no se edita el catálogo. Con Ventas sin Tablero se leen las oportunidades **cerradas**, sus clientes y productos.
- Por defecto, un usuario nuevo tiene Panel, Clientes, Tablero y Tareas.
- Con el módulo Etiquetas, un vendedor administra el catálogo. Con Auditoría, ve también el Historial de la ficha de cliente.
- El Panel no tiene datos propios: sus funciones corren con los permisos de quien consulta.

**Implementación**: `supabase/migrations/20261111200000_modulos_por_usuario.sql` (`usuarios.modulos`, `tiene_modulo()`, políticas RLS), Edge Function `users` (`MODULOS`, mismo orden que el CHECK: panel, clientes, oportunidades, actividades, productos, ventas, landings, etiquetas, auditoria), `domain/modulos.ts`, `providers/permissions.ts`, `root/CRM.tsx` (`conAcceso`), `layout/AppSidebar.tsx`, `usuarios/ModulosInput.tsx`.

---

## Fases 2 y 3 — Productos y canales 🟢

**Decisiones**
- Catálogo de productos con su propio módulo (`productos`): nombre, descripción, precio de lista, activo.
- La oportunidad lleva **varias líneas**: producto, cantidad, precio unitario (por defecto, el de lista) y descuento %. **El importe es la suma** de los subtotales, y el título (`producto_servicio`) se arma solo: "A", "A y B" o "A y N más".
- Un producto en uso no se borra: se desactiva. Uno inactivo no se puede agregar, pero queda en las oportunidades que ya lo tenían.
- Canales: catálogo que maneja **solo el administrador**. Vienen cargados: WhatsApp, Instagram, Facebook, Sitio web, Landing, Referido, Llamada, Email, Visita / local, Otro.
- El canal **vive en la oportunidad y toma por defecto el canal de origen del cliente**. El cliente que llega por una landing queda con «Landing» (`clave = 'landing'`, no se borra).

**Base**: `supabase/pendientes/20261111210000_productos_y_canales.sql` (tablas, triggers de líneas y canal, vistas `productos_resumen` / `canales_resumen`, `canal_nombre` en las vistas, migración de los datos existentes).

**Frontend**
- `productos/`: `ProductosPage`, `ProductoFormDialog` (Desactivar/Activar con `GuardarCon`; Eliminar solo si no se usa), `useProductos`.
- `canales/`: `CanalesPage`, `CanalFormDialog`, `CanalInput` (selector: activos + el actual), `useCanales`.
- `oportunidades/LineasProductosInput.tsx` (+ `lineasProductos.ts`): líneas con `useFieldArray`; el producto completa el precio; subtotal y total en vivo; no deja repetir un producto.
- `OportunidadInputs.tsx`: secciones Cliente y canal / Productos / Negociación; el canal se completa con el del cliente (`useCanalDelCliente`).
- `providers/dataProvider.ts`: recursos `productos`, `canales`; en `oportunidades` se escriben `productos` y `canal_id` (ya no `producto_servicio` ni `importe_estimado`); filtro `producto_id` → `productos@cs`; mensajes de error propios de la base (23503/23514 sin "constraint") llegan tal cual.
- Filtro y columna de canal en Clientes, Listado y Tablero (`FiltroCanal`).
- Auditoría: líneas como "2 × Producto ($ …)" y nombre del canal.
- `supabase/seed/datos_prueba.sql`: crea el catálogo, carga líneas (`pg_temp.lineas`) y canales.

---

## Fase 4 — Cerrar desde el tablero 🟢

**Decisiones**
- Zonas **"Ganada"** y **"Perdida"** que aparecen abajo (fijas) mientras se arrastra una tarjeta, más un **menú ⋯** en cada tarjeta con las mismas opciones (sirve con teclado y en el celular).
- Ganada: un diálogo confirma los productos (importe final, descuentos) y la fecha de cierre.
- Perdida: motivo **obligatorio de un catálogo fijo** (Precio, Competencia, Sin respuesta, Eligió otra solución, Otro) **+ detalle libre opcional** (confirmado con el usuario el 2026-11-12).

**Base**: `supabase/pendientes/20261112100000_motivos_de_perdida.sql`: `oportunidades.motivo_perdida_tipo` (CHECK de valores + CHECK "perdida exige motivo"), `oportunidades_normalizar` pide el motivo con mensaje claro y lo limpia si no es perdida; clasifica los textos existentes; recrea `oportunidades_resumen`.

**Frontend**
- `tablero/ZonasCierre.tsx` (Droppables `cierre:ganada|perdida`, `position: fixed`, se montan en `onBeforeCapture`), `cierre.ts`, `CerrarOportunidadDialog.tsx`.
- `OportunidadTablero.tsx`: soltar en una zona o elegir en el menú abre el diálogo; al guardar, `quitarDelTablero` (en `columnasEnCache.ts`) la saca de las columnas.
- `TableroTarjeta.tsx`: menú ⋯ (Marcar ganada / perdida / Abrir); sin animación de vuelta al soltar en una zona.
- `OportunidadInputs.tsx`: con resultado cerrado, fecha de cierre; con perdida, motivo (select) + detalle.
- `dataProvider`: `fecha_cierre` y `motivo_perdida_tipo` escribibles. `RecordFormDialog` acepta `submitLabel`.

---

## Fase 5 — Sección Ventas 🟢

**Decisiones**
- Módulo **`ventas`** (CHECK, `MODULOS` en frontend y Edge Function, administradores).
- Ítem "Ventas" en el menú: **Reportes** (pestaña por defecto) y **Listado de ganadas**, con los mismos filtros (período de cierre, vendedor, canal, producto) y exportación a CSV.
- Reportes: total vendido, cantidad de ventas, ticket promedio, ciclo promedio (días entre `creado_en` y `fecha_cierre`), tasa de cierre (ganadas sobre ganadas + perdidas); ventas por canal; ranking de vendedores (importe, cantidad, tasa de cierre, ciclo); productos más vendidos (por importe o cantidad); motivos de pérdida.
- **El ranking lo ve todo el que tenga el módulo.** Con varios responsables, **cada uno suma la venta completa**.
- Queda afuera (salvo que el usuario lo pida): **tiempo en cada etapa** (necesita un historial de etapas que no existe).

**Base**: `supabase/pendientes/20261112110000_ventas.sql`: módulo en el CHECK y en los administradores; `oportunidades_select` (cerradas con `ventas`), `productos_select` y `clientes_select` con `ventas`; función `ventas_reporte(p_desde, p_hasta, p_vendedor, p_canal, p_producto) returns jsonb` (todas las secciones en una consulta, con los permisos de quien consulta).

**Frontend**: `ventas/` — `VentasPage` (pestañas, filtros guardados en el store), `filtrosVentas.ts` (períodos, filtro del listado, `useVentasReporte`), `FiltrosVentasBarra`, `VentasListado` (recurso `ventas` = `oportunidades_resumen` de solo lectura; CSV con `;` y coma decimal), `VentasReportes`, `BarrasHorizontales`. `CrmList` acepta `filter` fijo y título opcional. Período nuevo "Últimos 12 meses" en `dashboard/periodos.ts`.

---

## Etiquetas ✅

Pedido del usuario (2026-11-12): "simplemente una mejor distribución, no añadirle cosas, solo la edición rápida". `etiquetas/EtiquetasPage.tsx` pasó de tabla a grilla de tarjetas; `EtiquetaFila.tsx`: el nombre se ve como el chip y se edita en el lugar, el color desde su punto (popover), papelera con confirmación. El alta sigue con el modal.

---

## Pendientes sueltos

- Publicar el frontend (Netlify), recordatorios por email, importación/exportación CSV de clientes: ver "Pendiente" en el README.

---

## Cómo trabajar

- **Credenciales:** en `CREDENCIALES.md` (raíz, ignorado por git) están la cuenta de Supabase, la base, las claves, el **Personal Access Token** (`sbp_…`) y los usuarios del CRM (administrador y vendedores de prueba). No las imprimas; léelas del archivo.
- **Migraciones:**
  - `npm run db:push` aplica las de `supabase/migrations/` que falten, cada una en una transacción.
  - Para ver cuáles están aplicadas: `node scripts/db.mjs psql -tA -c "select version from supabase_migrations.schema_migrations order by 1"`.
- **Probar antes de aplicar:** pasarle a `node scripts/db.mjs psql -tA -v ON_ERROR_STOP=0 -f <archivo>` un `begin;` + las migraciones + pruebas + `rollback;`. Para simular un usuario:
  ```sql
  select set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true);
  set local role authenticated;
  ```
  Para probar el seed sobre la base con datos: sacarle `begin;`/`commit;`, reactivar a Lucía y renombrar los slugs de las landings de prueba (con `disable trigger user`), todo dentro de la transacción.
- **Edge Function:**
  ```bash
  SUPABASE_ACCESS_TOKEN=$(grep -o 'sbp_[A-Za-z0-9]*' CREDENCIALES.md | head -1) \
    npx supabase functions deploy users --use-api --project-ref dzabqnznnotkztrdextl --yes
  ```
- **Calidad:** `npm run typecheck && npm run lint && npm run build`, y `npx prettier --check "src/**/*.{ts,tsx}"`.
- **Ojo en Windows:** editar archivos con Python en modo texto los guarda con CRLF y prettier los marca. Escribir en binario o normalizar a LF.
- **Despliegue:** primero la base, después la función y al final el frontend. Si el frontend pide columnas que todavía no existen, el perfil no carga o las pantallas fallan.
