# Integración con WhatsApp y Pedidos

Documento de trabajo del módulo. Recoge la propuesta original del usuario
(`modulo_integracion_whatsapp_crm.md`, v1.0, 2026-11-12, no está en el repo) y lo decidido con
él el 2026-11-12. **Estado: en definición, sin código.** Lo marcado como decisión ya está
acordado: no volver a preguntarlo. Lo que está en "Pendiente de definir" sí hay que preguntarlo.

## La idea

- El CRM **guía a la empresa** por el alta manual de WhatsApp Cloud API (la API oficial de Meta,
  con una app de Meta propia de cada empresa) para que **nos dé acceso a su número**. No se usa
  Embedded Signup, Kapso ni Baileys.
- El **bot no vive en el CRM**: corre en un **VPS nuestro** y su cerebro es **Claude Haiku**
  (`claude-haiku-5-5`). Todavía no está programado.
- El bot **responde preguntas** del comprador ("¿hay poleras verdes?") y **registra pedidos** en
  el CRM, para ahora o para una fecha ("traeme 2 poleras a casa", "mañana a las 3").
- Solo responde mensajes que inicia el comprador. Nada de campañas ni mensajes promocionales.

```
Comprador ─► Meta (Cloud API) ─► VPS: bot con Haiku ─► API del CRM (config, catálogo, pedidos, avisos)
CRM: asistente de conexión · credenciales en Vault · pantalla de estado · Pedidos
```

## Decisiones (2026-11-12)

| Tema | Decisión |
|---|---|
| Rol del CRM | Asistente de alta, guardar credenciales, estado de la conexión, API para el bot y la vista de Pedidos. El CRM no conversa con nadie. |
| Bot | En un VPS, con Claude Haiku. Se programa aparte. |
| Atención humana | **La resuelve el VPS.** El CRM no tiene bandeja de conversaciones. |
| Pedidos | **Entidad y vista propias**, no el Tablero de oportunidades. |
| Fecha de entrega | **Opcional.** Sin fecha, el pedido es "para ahora"; con fecha, se guardan día y hora. |
| Ventas | Al marcarse **Entregado**, el pedido cuenta como venta con canal WhatsApp en Ventas y en el Panel. |
| Ranking | La venta se le acredita **al bot**: aparece "Bot WhatsApp" en el ranking de vendedores. |
| Avisos al comprador | Cuando cambia el estado del pedido se le avisa por WhatsApp **solo dentro de las 24 h** desde su último mensaje. Pasado eso, no se envía nada (no hay plantillas). |
| Métricas de Ventas | (El usuario lo delegó.) Las ventas que vienen de pedidos suman en total vendido, cantidad, ticket promedio, ventas por canal, productos más vendidos, ranking (fila del bot) y Panel. **No entran en el ciclo promedio ni en la tasa de cierre**, que miden el embudo de oportunidades; en la fila del bot esas dos columnas van vacías. Un pedido Cancelado no es una oportunidad perdida. |
| Revertir un Entregado | **Se puede**, volviendo a otro estado o a Cancelado. La venta enlazada se elimina, se pide un motivo y **queda registro**: historial del pedido (quién, cuándo, de qué estado a cuál, motivo) y auditoría. |
| VPS | **Uno solo para los bots de todas las empresas.** |
| Fuera del alcance | Plantillas de Meta, campañas, Coexistence (seguir usando la app de WhatsApp Business en el mismo número), Embedded Signup, Tech Provider. |

## Valores por defecto (propuestos al usuario, sin objeción; confirmar al implementar)

- **Una instancia del CRM (proyecto Supabase) por empresa**, como hoy. El CRM no es multiempresa
  (ninguna tabla tiene `empresa_id`); la sección 6 de la propuesta original lo suponía.
- **Los webhooks de Meta llegan directo al VPS.** El CRM genera un id de instancia y la URL que
  muestra el asistente es `https://<vps>/webhook/<id-instancia>`: con eso el VPS sabe qué App
  Secret usar, atienda a una empresa o a muchas.
- **Estados del pedido:** Nuevo → En preparación → En camino (envío) o Listo para retirar
  (retiro) → Entregado; en cualquier momento, Cancelado.
- **Datos del pedido:** cliente, líneas (producto, cantidad, precio unitario), tipo de entrega
  (envío / retiro), dirección si es envío, fecha y hora de entrega opcional, nota libre. Sin
  pagos ni costo de envío.
- **Vista Pedidos:** tablero por estado con filtro Hoy / Mañana / Semana; en cada columna,
  primero los "para ahora" y después por hora de entrega. Un pedido nuevo aparece en la campana.
- **Módulo nuevo `pedidos`** en el sistema de módulos por usuario. La configuración de WhatsApp
  es solo del administrador (como Canales).
- **Cliente:** el bot lo busca por teléfono y, si no existe, lo crea con canal «WhatsApp» (como
  hace la landing). El pedido queda vinculado.
- **"Información para el bot":** un texto libre en la configuración (horarios, zonas de envío,
  medios de pago, dirección del local, preguntas frecuentes) que edita el administrador y el VPS
  lee por la API. Sin esto el bot solo sabe del catálogo.

## Pendiente de definir

1. **De dónde saca el bot las respuestas sobre el catálogo** ("¿hay poleras verdes?"). Hoy un
   producto solo tiene nombre, descripción, precio de lista y activo. Opciones:
   - a. De la descripción ("Colores: verde, negro. Tallas S a XL"): sin cambios en Productos,
     pero el bot no sabe cantidades.
   - b. Variantes (color, talla) con stock propio: el bot responde "quedan 3 verdes en M" y el
     pedido descuenta. Cambia Productos, las líneas de las oportunidades y los reportes.
   - c. Stock por producto, sin variantes: cada variación se carga como producto aparte.
   El usuario: "aún no definido" (lo confirmó dos veces el 2026-11-12). No frena las fases 1 a 3:
   la API del bot puede sumar estos datos después.
2. **Quién completa el asistente.** Crear la app en Meta for Developers, el usuario del sistema y
   el token permanente es lo más difícil para un comerciante no técnico. Probablemente haya que
   acompañarlo por llamada las primeras veces.
3. **Fotos de productos** para que el bot las mande: hoy los productos no tienen imagen.
4. **Costo de la IA por empresa.** Haiku lo pagamos nosotros y un solo VPS atiende a todas: ¿se
   cobra por uso, hay un tope de mensajes por empresa, va incluido en el plan? El VPS debería
   registrar los tokens consumidos por instancia desde el día uno.

## Alcance del MVP en el CRM

1. **Asistente de 6 pasos** (solo administrador), con el progreso guardado:
   1. Portafolio empresarial en Meta Business Suite (explicación + enlace + marcar hecho).
   2. App en Meta for Developers con el caso de uso WhatsApp; cuenta de WhatsApp Business (WABA).
   3. Número: advertencia de que deja de funcionar en la app de WhatsApp del celular, nombre para
      mostrar, verificación por SMS o llamada (el código se escribe en Meta, nunca en el CRM),
      dónde encontrar el Phone Number ID y el WABA ID.
   4. Credenciales: App ID, WABA ID, Phone Number ID, token de usuario del sistema, App Secret y
      el PIN de verificación en dos pasos (para registrar el número; no se guarda).
   5. Webhook: URL del VPS + Verify Token generado por el CRM, y qué eventos suscribir
      (`messages`).
   6. Prueba: mensaje real desde un teléfono, respuesta del bot, consulta de un producto, pedido
      de prueba (marcado como prueba para no ensuciar Ventas) y activación del bot.
2. **Credenciales** en Supabase Vault. Una Edge Function (solo administradores) las valida contra
   Meta al guardarlas: el token puede usar el número, el número pertenece a la WABA. Además:
   - registra el número en Cloud API: `POST /{phone_number_id}/register` con el PIN;
   - suscribe la WABA a la app: `POST /{waba_id}/subscribed_apps` (sin esto no llega ningún
     mensaje).
   El token y el App Secret nunca vuelven al navegador; después de guardarlos se muestran
   enmascarados. Se pueden reemplazar o revocar.
3. **Pantalla de estado:** No configurado / Configurando / Conectado / Error / Desconectado;
   número y nombre; último mensaje recibido y último error (los informa el VPS); botones Probar
   conexión, Pausar/Activar bot, Desconectar, Ver instrucciones.
4. **API para el bot** (contrato abajo).
5. **Pedidos:** tablas, módulo, vista, estados, Entregado → venta, reversión con motivo,
   historial en el detalle del pedido, campana.
6. **Avisos de cambio de estado** para que el VPS los envíe dentro de la ventana de 24 h.

## Propuesta técnica

- **Usuario "Bot WhatsApp"** en `usuarios` (marcado como bot, sin acceso a la interfaz y fuera de
  los selectores de asignación). Es el responsable de las ventas del bot, así el ranking lo
  muestra sin cambiar `ventas_reporte` (el ranking se arma por responsables). Las escrituras del
  bot llevan `crm.origen = 'Bot WhatsApp'`, igual que la landing, para que la auditoría sea
  legible.
- **Pedido Entregado → venta:** un trigger crea una oportunidad **ganada** (cliente, líneas, canal
  WhatsApp, responsable el bot, `fecha_cierre` = día de entrega) y la enlaza en
  `pedidos.oportunidad_id`. Ventas, Panel, productos más vendidos y ranking funcionan sin tocarlos.
  Las oportunidades que vienen de un pedido no se editan desde el Tablero. La alternativa (sumar
  los pedidos en cada función de reporte) evita duplicar datos pero toca todos los reportes.
  - `ventas_reporte` excluye las oportunidades con pedido del ciclo promedio y de la tasa de
    cierre (global y por vendedor).
  - **Revertir:** al salir de Entregado se pide un motivo, se elimina la oportunidad enlazada
    (la auditoría registra la eliminación con origen "Pedido #N revertido") y se anota el cambio
    en el historial. Si se vuelve a entregar, se crea una venta nueva.
- **Tablas previstas:** `whatsapp_integracion` (una fila: estado, IDs de Meta, referencias a los
  secretos en Vault, `bot_activo`, información para el bot, último mensaje recibido, último
  control, último error), `pedidos`, `pedido_lineas`, `pedido_historial` (cada cambio de estado:
  usuario, fecha, de / a, motivo), `pedido_avisos`.
- **Un solo VPS para todas las empresas:**
  - El VPS tiene una **lista de instancias autorizadas** (id, URL del CRM, activa sí/no). Dar de
    alta una empresa = agregarla a esa lista. Sin esto, cualquiera podría armar un "CRM" falso,
    apuntarlo al VPS y usar el bot (y Haiku) gratis. La lista también sirve para suspender a un
    cliente.
  - La URL del webhook es `https://<vps>/webhook/<id-instancia>`; el id dice qué CRM consultar y
    qué App Secret usar para validar la firma.
  - **Autenticación VPS → CRM:** el VPS firma cada llamada (token corto, con el id de la
    instancia como destinatario) con una **clave privada que solo tiene él**; cada CRM guarda la
    **clave pública** y comprueba la firma. No hay secretos para copiar por cliente, y si se
    filtra la configuración de un CRM no se puede entrar a los demás. El VPS **no** recibe la
    clave maestra de Supabase de ningún CRM.
- **Idempotencia:** el VPS manda una clave única por pedido (`pedidos.clave_idempotencia
  unique`); si Meta reenvía un mensaje o el VPS reintenta, no se duplica el pedido.
- **Avisos:** un trigger en el cambio de estado agrega una fila pendiente en `pedido_avisos`. El
  VPS consulta cada instancia periódicamente (por ejemplo, cada minuto), envía las que caen dentro
  de la ventana de 24 h y las marca enviadas o vencidas. Ojo: un pedido para "pasado mañana" no va a poder recibir "En camino" salvo que el
  comprador vuelva a escribir.
- **Teléfonos:** WhatsApp manda el número en formato internacional sin `+` (`wa_id`; los
  celulares argentinos llegan como `549…`). La landing compara los últimos 10 dígitos, que falla
  con teléfonos cargados con "15". Normalizar antes de comparar.

### Contrato de la API para el bot (borrador)

Edge Function `bot` en cada CRM. El VPS se autentica con un token firmado con su clave privada
(ver "Un solo VPS para todas las empresas").

| Operación | Qué hace |
|---|---|
| Leer configuración | Token de Meta, App Secret, Phone Number ID, WABA ID, Verify Token, `bot_activo` e información para el bot. |
| Listar productos | Activos, con nombre, descripción y precio (y lo que se decida en "Pendiente" 1). |
| Buscar o crear cliente | Por teléfono; si no existe, lo crea con canal WhatsApp. |
| Crear pedido | Con clave de idempotencia; los precios los toma la base, no el bot. |
| Avisos pendientes | Lista y marcar como enviado o vencido. |
| Informar estado | Último mensaje recibido, errores de Meta (token vencido, número desconectado). |

## Notas de Meta para el asistente

- **Tres verificaciones distintas:** crear el portafolio empresarial (alta, sin documentos);
  verificar el número (SMS o llamada); verificación empresarial con documentos (normalmente no
  hace falta para empezar, pero Meta puede pedirla).
- **El número deja de funcionar en la app de WhatsApp / WhatsApp Business del celular** al
  registrarlo en Cloud API. Conviene un número dedicado.
- **Token:** de un **usuario del sistema** del portafolio, con la WABA asignada y los permisos
  `whatsapp_business_messaging` y `whatsapp_business_management`, sin vencimiento. El token
  temporal de la consola de pruebas vence en horas: no sirve.
- **Verificación del webhook:** Meta hace un `GET` con `hub.mode=subscribe`, `hub.verify_token` y
  `hub.challenge`; hay que devolver el `challenge` solo si el token coincide. Meta verifica al
  guardar, así que **los pasos 5 y 6 necesitan el VPS funcionando**.
- **Firma:** cada evento trae `X-Hub-Signature-256`, un HMAC-SHA256 del cuerpo sin procesar con el
  App Secret.
- **Modo Live:** para publicar la app Meta pide una URL de política de privacidad.
- **Para desarrollar:** Meta da un número de prueba que puede escribir a hasta 5 destinatarios.
- **Ventana de 24 h:** desde el último mensaje del comprador se puede responder libremente; fuera
  de ella solo con plantillas aprobadas (que este proyecto no usa).
- **Costos:** Meta cobra por mensaje de plantilla; las respuestas dentro de la ventana no se
  cobran. Verificar las tarifas vigentes para Argentina antes de lanzar.
- Los nombres de las secciones de Meta cambian: las instrucciones del asistente hay que revisarlas
  cada tanto.

## Para cuando se programe el VPS

- Guardar el evento y responder 200 enseguida; procesar después. Meta reintenta si tarda.
- No procesar dos veces el mismo mensaje (id `wamid`).
- **Ráfagas:** "hola" / "quiero 2" / "de la grande" son 3 webhooks casi juntos. Bloqueo por
  conversación y esperar unos segundos para agrupar antes de llamar a Haiku.
- Audios, imágenes, ubicación y stickers: definir qué responde el bot.
- Haiku consulta el catálogo con herramientas; el carrito, los precios y el total los arma el
  código con datos del CRM. Confirmación explícita (idealmente un botón "Confirmar pedido") antes
  de crear el pedido.
- Límite de mensajes por contacto y por día, para acotar el costo de la IA.
- Respetar `bot_activo` (Pausar en el CRM) y la atención humana (a cargo del VPS).
- **Varias empresas en un mismo VPS:** cola y límites por instancia, para que el tráfico (o el
  spam) de una no frene a las demás; configuración de cada instancia en caché con vencimiento
  corto (para que Pausar y Desconectar se noten rápido); registrar los tokens de Haiku por
  instancia; un error de Meta en una empresa no afecta a las otras.

## Fases propuestas

1. ✅ **Base de pedidos** (2026-11-12, sin desplegar): ver "Fase 1 hecha" abajo.
2. **Conexión:** tabla `whatsapp_integracion` y secretos en Vault (se movieron de la fase 1 para
   diseñarlos junto con quien los usa), Edge Function de credenciales (validar, registrar número,
   suscribir WABA, probar), asistente pasos 1 a 4 y pantalla de estado.
3. **Pedidos:** vista, cambio de estado, campana.
4. **API del bot** y avisos.
5. **Pasos 5 y 6 del asistente**, cuando exista el VPS (o con un receptor mínimo de webhook para
   probar el circuito).

## Fase 1 hecha (2026-11-12) — sin desplegar

Migración `supabase/pendientes/20261112120000_pedidos.sql` (en `pendientes/` a propósito: se
despliega junto con el frontend de la fase 3) y la Edge Function `users` actualizada.

**Qué hace la migración**
- **Usuario del sistema "Bot WhatsApp"**: `usuarios.sistema`, cuenta en `auth.users` sin clave y
  bloqueada hasta 2999, `usuario_bot()`. No se modifica ni se borra (`usuarios_proteger`), no se
  asigna a clientes (`clientes_asignacion`) ni a oportunidades o tareas (`normalizar_asignados`;
  solo el sistema, desde un trigger). La Edge Function `users` lo rechaza (403).
- **Canal "WhatsApp" del sistema** (`clave = 'whatsapp'`): no se borra.
- **`armar_lineas()`**: valida líneas y calcula total y título; la usan oportunidades y pedidos.
- **Tablas** `pedidos`, `pedido_historial`, `pedido_avisos`; `oportunidades.pedido_id` (la venta).
- **Reglas** (triggers): empieza en Nuevo; En camino solo con envío y Listo para retirar solo con
  retiro; envío sin dirección toma la del cliente o falla; entregado o cancelado no se edita;
  entregado no se borra; Entregado crea la venta y salir de Entregado pide motivo y la borra.
- **`pedido_cambiar_estado(id, estado, motivo)`**: única vía para cambiar el estado desde la API.
- **Avisos**: cada cambio de estado de un pedido de WhatsApp deja uno pendiente y anula el
  anterior; volver a Nuevo o revertir una entrega no avisa (y anula el pendiente).
- **Ventas**: `ventas_reporte` excluye las ventas de pedidos del ciclo y de la tasa de cierre
  (global y por vendedor). Las ventas de pedidos no se editan ni se borran a mano.
- **Módulo `pedidos`** (CHECK y administradores). Con Pedidos se leen clientes y productos.
- **Auditoría**: entidad `pedidos`; la venta y su eliminación quedan con origen "Pedido #N" y
  "Pedido #N revertido".
- **Vistas**: `pedidos_resumen` (nueva), `oportunidades_resumen` (suma `pedido_id`),
  `productos_resumen` (suma `pedidos`). Un producto en pedidos no se borra.

**Decisiones tomadas al implementar**
- Un pedido **cargado por el equipo** (origen `manual`) también genera venta al entregarse: con el
  canal del cliente y como responsable **quien lo marca entregado**. Solo los de WhatsApp van al bot.
- Un pedido **de prueba** (`prueba = true`, para el asistente) no genera venta.
- Solo un administrador elimina pedidos (como clientes y oportunidades).
- Desde la API el equipo escribe cliente, entrega, dirección, fecha, productos y nota. El estado
  va por `pedido_cambiar_estado`. Origen, teléfono de WhatsApp, clave de idempotencia y "prueba"
  los pone solo el bot (clave de servicio).

**Probado** contra la base real dentro de una transacción con rollback (24 casos: permisos por
módulo, dirección, estados por tipo de entrega, idempotencia, avisos, venta del bot y manual,
reversión con motivo, protecciones, ranking y tasa de cierre, producto inactivo, cascada al
borrar el cliente, regresión de líneas en oportunidades). No queda nada aplicado.

**Pendiente para la fase 3 (frontend), si no la base rechaza o se ve raro**
- `domain/modulos.ts`, menú y rutas: módulo `pedidos`.
- `useUsuarios` y la pantalla Usuarios: ocultar a los usuarios con `sistema = true` (de los
  selectores y del listado); sus nombres sí se muestran (ranking, responsables de ventas).
- Auditoría: entidad `pedidos` en `types.ts`, `options.ts` y `textoAuditoria.ts`.
- Ventas y Listado de oportunidades: una venta con `pedido_id` se abre de solo lectura, con
  enlace al pedido.
- Productos: "Eliminar" también depende de `pedidos` (no solo de `oportunidades`).
- Seed de datos de prueba con pedidos.

**Despliegue (cuando esté la fase 3):** mover la migración a `supabase/migrations/`, `npm run
db:push`, desplegar la Edge Function `users`, después el frontend. Después de aplicar, verificar
que la pantalla Usuarios y el alta de usuarios sigan andando (la cuenta del bot se crea con SQL
directo en `auth.users`).
