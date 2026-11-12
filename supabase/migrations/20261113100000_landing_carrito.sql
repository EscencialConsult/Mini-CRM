-- Mini-CRM · carrito en las landings.
--
-- Una landing publicada puede tener un carrito (`publicada.carrito`, ver
-- landings/pagina/schema.ts). El visitante arma el carrito con productos activos
-- y lo manda con `landing_pedido`: se crea (o reconoce) al cliente igual que
-- `landing_recibir` y se guarda un PEDIDO de origen 'landing' con los precios
-- tomados de la tabla `productos`, nunca del navegador. La página abre después
-- WhatsApp con el mensaje armado.
-- Un pedido de landing entregado genera la venta con el canal «Landing»; el
-- responsable es el del cliente (el administrador de la landing) y nunca el bot.
-- `landing_productos` lista lo que el carrito puede mostrar.
-- Va después de 20261112120000_pedidos.

-- ============================================================================
-- Tablas: el origen 'landing' y el tipo de envío 'pedido'
-- ============================================================================
alter table public.pedidos drop constraint pedidos_origen_check;
alter table public.pedidos add constraint pedidos_origen_check
  check (origen in ('whatsapp', 'manual', 'landing'));

alter table public.landing_envios drop constraint landing_envios_tipo_check;
alter table public.landing_envios add constraint landing_envios_tipo_check
  check (tipo in ('formulario', 'whatsapp', 'pedido'));

-- ============================================================================
-- Entregado → venta: la de un pedido de landing lleva el canal «Landing» y de
-- responsable al del cliente (activo) o, si no tiene, al primer administrador
-- ============================================================================
create or replace function public.pedidos_estado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_origen text := coalesce(current_setting('crm.origen', true), '');
  v_motivo text := nullif(btrim(current_setting('crm.motivo_estado', true)), '');
  v_responsable uuid;
begin
  if tg_op = 'INSERT' and new.estado <> 'nuevo' then
    raise exception 'Un pedido empieza en «Nuevo»' using errcode = '23514';
  end if;
  if new.estado = 'en_camino' and new.tipo_entrega = 'retiro' then
    raise exception 'Un pedido para retirar no va «En camino»: usá «Listo para retirar»'
      using errcode = '23514';
  end if;
  if new.estado = 'listo_para_retirar' and new.tipo_entrega = 'envio' then
    raise exception 'Un pedido con envío no queda «Listo para retirar»: usá «En camino»'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.entregado_en := null;
    return new;
  end if;
  if new.estado = old.estado then
    new.entregado_en := old.entregado_en;
    return new;
  end if;

  if old.estado = 'entregado' then
    if v_motivo is null then
      raise exception 'Para revertir una entrega indicá el motivo' using errcode = '23514';
    end if;
    perform set_config('crm.origen', 'Pedido #' || old.id || ' revertido', true);
    delete from public.oportunidades where pedido_id = old.id;
    perform set_config('crm.origen', v_origen, true);
    new.entregado_en := null;
  end if;

  if new.estado = 'entregado' then
    new.entregado_en := now();
    if not new.prueba then
      if new.origen = 'landing' then
        select u.id into v_responsable
        from public.usuarios u
        where u.activo and not u.sistema
          and (
            u.id = (select c.asignado_a from public.clientes c where c.id = new.cliente_id)
            or u.rol = 'administrador'
          )
        order by
          (u.id = (select c.asignado_a from public.clientes c where c.id = new.cliente_id)) desc,
          u.creado_en
        limit 1;
      end if;

      perform set_config('crm.origen', 'Pedido #' || new.id, true);
      insert into public.oportunidades (
        cliente_id, productos, canal_id, etapa, resultado, fecha_cierre, asignados, descripcion, pedido_id
      )
      values (
        new.cliente_id,
        new.productos,
        -- Manual: el canal del cliente (oportunidades_canal)
        case new.origen
          when 'whatsapp' then (select ca.id from public.canales ca where ca.clave = 'whatsapp')
          when 'landing' then (select ca.id from public.canales ca where ca.clave = 'landing')
        end,
        'negociacion',
        'ganada',
        (new.entregado_en at time zone 'America/Argentina/Buenos_Aires')::date,
        -- Manual: quien lo entrega (asignar_por_defecto)
        case new.origen
          when 'whatsapp' then array[public.usuario_bot()]
          when 'landing' then coalesce(array[v_responsable], '{}'::uuid[])
          else '{}'::uuid[]
        end,
        'Pedido #' || new.id,
        new.id
      );
      perform set_config('crm.origen', v_origen, true);
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Productos que muestra el carrito de una landing publicada
-- ============================================================================
-- Solo id, nombre, descripción y precio de los productos activos que el carrito
-- permite (`productoIds` vacío: todos los activos). `[]` si el carrito no está
-- activo o la landing no está publicada.
create function public.landing_productos(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with landing as (
    select l.publicada -> 'carrito' as carrito
    from public.landings l
    where l.slug = lower(btrim(p_slug)) and l.estado = 'publicada'
  ),
  permitidos as (
    select array(
      select (x.valor #>> '{}')::bigint
      from landing,
        jsonb_array_elements(
          case when jsonb_typeof(landing.carrito -> 'productoIds') = 'array'
            then landing.carrito -> 'productoIds' else '[]'::jsonb end
        ) as x(valor)
      where jsonb_typeof(x.valor) = 'number'
    ) as ids
  )
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio)
        order by p.nombre
      )
      from landing, permitidos, public.productos p
      where coalesce((landing.carrito ->> 'activo')::boolean, false) is true
        and p.activo
        and (cardinality(permitidos.ids) = 0 or p.id = any (permitidos.ids))
    ),
    '[]'::jsonb
  )
$$;

-- ============================================================================
-- landing_pedido
-- ============================================================================
/**
 * Recibe el carrito de una landing publicada:
 *  {"slug", "nombre", "telefono", "email"?, "entrega": "envio" | "retiro",
 *   "direccion"?, "nota"?, "utm"?, "website"?,
 *   "lineas": [{"producto_id", "cantidad"}]}
 * Devuelve {"pedido_id", "total", "lineas": [{"nombre", "cantidad", "precio", "subtotal"}]}.
 * Los precios salen de la tabla `productos`. Cada error lleva un mensaje en
 * español (`message`) y el hint `landing_pedido`; el límite por conexión lleva
 * además el detalle `rate_limited` y la landing inexistente, `not_found`.
 */
create function public.landing_pedido(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_datos ->> 'slug', '')));
  v_landing public.landings;
  v_carrito jsonb;
  v_seguimiento jsonb;
  v_utm jsonb := coalesce(p_datos -> 'utm', '{}'::jsonb);
  v_entrada jsonb;
  v_agrupadas jsonb;
  v_permitidos bigint[];
  v_linea jsonb;
  v_cantidad numeric;
  v_producto_id numeric;
  v_entrega text := p_datos ->> 'entrega';
  v_direccion text;
  v_nota text;
  v_nombre_completo text;
  v_nombre text;
  v_apellido text;
  v_email text;
  v_telefono text;
  v_digitos text;
  v_palabras text[];
  v_ip text;
  v_ip_hash text;
  v_admin uuid;
  v_responsable uuid;
  v_cliente_id bigint;
  v_cliente_nuevo boolean := false;
  v_etiquetas bigint[];
  v_pedido public.pedidos;
  v_resumen text;
  v_tarea text;
  v_dias int;
begin
  -- Solo los bots completan el campo trampa: reciben un ok y no se guarda nada
  if jsonb_typeof(p_datos) is distinct from 'object' then
    raise exception 'Los datos del pedido no son válidos' using errcode = '22023', hint = 'landing_pedido';
  end if;
  if coalesce(p_datos ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;
  if v_slug = '' or jsonb_typeof(v_utm) <> 'object' then
    raise exception 'Los datos del pedido no son válidos' using errcode = '22023', hint = 'landing_pedido';
  end if;

  select * into v_landing from public.landings where slug = v_slug and estado = 'publicada';
  if not found then
    raise exception 'Esta página no está disponible' using errcode = 'P0002', hint = 'landing_pedido', detail = 'not_found';
  end if;
  v_carrito := v_landing.publicada -> 'carrito';
  if coalesce((v_carrito ->> 'activo')::boolean, false) is not true then
    raise exception 'El carrito no está disponible en esta página' using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- Datos del comprador
  v_nombre_completo := left(regexp_replace(btrim(coalesce(p_datos ->> 'nombre', '')), '\s+', ' ', 'g'), 120);
  if v_nombre_completo = '' then
    raise exception 'Escribí tu nombre' using errcode = '22023', hint = 'landing_pedido';
  end if;
  v_telefono := left(btrim(coalesce(p_datos ->> 'telefono', '')), 40);
  v_digitos := regexp_replace(v_telefono, '\D', '', 'g');
  if length(v_digitos) not between 8 and 15 then
    raise exception 'Escribí un teléfono válido, con código de área' using errcode = '22023', hint = 'landing_pedido';
  end if;
  v_email := nullif(lower(btrim(coalesce(p_datos ->> 'email', ''))), '');
  if v_email is not null and (length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'El email no es válido' using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- Entrega
  if v_entrega is null or v_entrega not in ('envio', 'retiro') then
    raise exception 'Elegí si es envío o retiro' using errcode = '22023', hint = 'landing_pedido';
  end if;
  v_direccion := nullif(left(btrim(coalesce(p_datos ->> 'direccion', '')), 300), '');
  if v_entrega = 'envio' and v_direccion is null then
    raise exception 'Escribí la dirección de entrega' using errcode = '22023', hint = 'landing_pedido';
  end if;
  if v_entrega = 'retiro' then
    v_direccion := null;
  end if;
  v_nota := nullif(left(btrim(coalesce(p_datos ->> 'nota', '')), 500), '');

  -- Carrito: 1 a 30 líneas, cantidades enteras de 1 a 99
  v_entrada := p_datos -> 'lineas';
  if jsonb_typeof(v_entrada) is distinct from 'array' or jsonb_array_length(v_entrada) = 0 then
    raise exception 'Tu carrito está vacío' using errcode = '22023', hint = 'landing_pedido';
  end if;
  if jsonb_array_length(v_entrada) > 30 then
    raise exception 'El carrito admite hasta 30 productos distintos' using errcode = '22023', hint = 'landing_pedido';
  end if;
  for v_linea in select value from jsonb_array_elements(v_entrada) loop
    if jsonb_typeof(v_linea) is distinct from 'object'
       or jsonb_typeof(v_linea -> 'producto_id') is distinct from 'number'
       or jsonb_typeof(v_linea -> 'cantidad') is distinct from 'number' then
      raise exception 'Hay un producto del carrito con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
    end if;
    v_producto_id := (v_linea ->> 'producto_id')::numeric;
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    if v_producto_id <> trunc(v_producto_id) or v_producto_id < 1 or v_producto_id > 9007199254740991 then
      raise exception 'Hay un producto del carrito con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
    end if;
    if v_cantidad <> trunc(v_cantidad) or v_cantidad < 1 or v_cantidad > 99 then
      raise exception 'La cantidad de cada producto debe ser de 1 a 99' using errcode = '22023', hint = 'landing_pedido';
    end if;
  end loop;

  -- Un mismo producto repetido se suma
  select jsonb_agg(jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad) order by t.producto_id)
    into v_agrupadas
  from (
    select (l.valor ->> 'producto_id')::bigint as producto_id, sum((l.valor ->> 'cantidad')::numeric) as cantidad
    from jsonb_array_elements(v_entrada) as l(valor)
    group by 1
  ) t;
  if exists (select 1 from jsonb_array_elements(v_agrupadas) as l(valor) where (l.valor ->> 'cantidad')::numeric > 99) then
    raise exception 'La cantidad de cada producto debe ser de 1 a 99' using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- Productos activos y, si la landing lo restringe, de los permitidos
  v_permitidos := array(
    select (x.valor #>> '{}')::bigint
    from jsonb_array_elements(
      case when jsonb_typeof(v_carrito -> 'productoIds') = 'array' then v_carrito -> 'productoIds' else '[]'::jsonb end
    ) as x(valor)
    where jsonb_typeof(x.valor) = 'number'
  );
  if exists (
    select 1
    from jsonb_array_elements(v_agrupadas) as l(valor)
    left join public.productos p on p.id = (l.valor ->> 'producto_id')::bigint
    where p.id is null
       or not p.activo
       or (cardinality(v_permitidos) > 0 and p.id <> all (v_permitidos))
  ) then
    raise exception 'Alguno de los productos ya no está disponible: actualizá la página y armá el carrito de nuevo'
      using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- 5 envíos por conexión cada 10 minutos (el mismo límite que landing_recibir)
  v_ip := coalesce(
    nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'cf-connecting-ip', ''),
    nullif(btrim(split_part(
      coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-forwarded-for', ',', 1
    )), ''),
    'desconocida'
  );
  v_ip_hash := encode(sha256(convert_to(
    (select valor from privado.ajustes where clave = 'ip_sal') || ':' || v_ip, 'UTF8'
  )), 'hex');
  if (
    select count(*) from public.landing_envios
    where ip_hash = v_ip_hash and creado_en > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Hiciste varios pedidos desde tu conexión: volvé a intentarlo en unos minutos'
      using errcode = 'P0001', hint = 'landing_pedido', detail = 'rate_limited';
  end if;

  v_seguimiento := coalesce(v_landing.publicada -> 'automation', '{}'::jsonb);
  v_etiquetas := array(
    select e.id
    from jsonb_array_elements(
      case when jsonb_typeof(v_seguimiento -> 'tagIds') = 'array' then v_seguimiento -> 'tagIds' else '[]'::jsonb end
    ) as x(valor)
    join public.etiquetas e on jsonb_typeof(x.valor) = 'number' and e.id = (x.valor #>> '{}')::bigint
  );

  -- "Juan Pablo Pérez": el apellido es la última palabra
  v_palabras := regexp_split_to_array(v_nombre_completo, ' ');
  if array_length(v_palabras, 1) > 1 then
    v_nombre := array_to_string(v_palabras[1:array_length(v_palabras, 1) - 1], ' ');
    v_apellido := v_palabras[array_length(v_palabras, 1)];
  else
    v_nombre := v_palabras[1];
  end if;

  -- El mismo cliente si coincide el email o el teléfono (últimos 10 dígitos)
  select c.id into v_cliente_id
  from public.clientes c
  where (v_email is not null and lower(c.email) = v_email)
     or (
       length(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g')) >= 8
       and right(regexp_replace(c.telefono, '\D', '', 'g'), least(10, length(v_digitos)))
           = right(v_digitos, least(10, length(regexp_replace(c.telefono, '\D', '', 'g'))))
     )
  order by coalesce(v_email is not null and lower(c.email) = v_email, false) desc, c.creado_en
  limit 1;

  -- El administrador elegido en la landing, si sigue activo; si no, el primero
  select u.id into v_admin
  from public.usuarios u
  where u.rol = 'administrador' and u.activo and not u.sistema
  order by coalesce(u.id::text = (v_seguimiento ->> 'adminId'), false) desc, u.creado_en
  limit 1;

  -- Lo que se escribe desde acá queda en la auditoría con este origen
  perform set_config('crm.origen', 'Landing «' || v_landing.nombre || '»', true);

  if v_cliente_id is null then
    -- Canal «Landing»: lo pone clientes_canal por el landing_id
    insert into public.clientes (tipo, nombre, apellido, email, telefono, direccion, asignado_a, landing_id, etiquetas)
    values (
      'persona', v_nombre, v_apellido, v_email, v_telefono, v_direccion, v_admin, v_landing.id, v_etiquetas
    )
    returning id into v_cliente_id;
    v_cliente_nuevo := true;
    v_responsable := v_admin;
  else
    -- Si ya tiene responsable activo, el seguimiento es suyo
    select coalesce(u.id, v_admin) into v_responsable
    from public.clientes c
    left join public.usuarios u on u.id = c.asignado_a and u.activo
    where c.id = v_cliente_id;

    update public.clientes
    set etiquetas = etiquetas || v_etiquetas
    where id = v_cliente_id and not etiquetas @> v_etiquetas;
  end if;

  -- Los precios los toma la base: viajan solo producto y cantidad y
  -- pedidos_preparar (armar_lineas) completa nombre, precio y subtotal
  insert into public.pedidos (cliente_id, origen, tipo_entrega, direccion, productos, nota)
  values (v_cliente_id, 'landing', v_entrega, v_direccion, v_agrupadas, v_nota)
  returning * into v_pedido;

  v_resumen := (
    select string_agg(
      (l.valor ->> 'cantidad') || ' × ' || (l.valor ->> 'nombre') || ' ($ ' || (l.valor ->> 'subtotal') || ')',
      E'\n' order by l.posicion
    )
    from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
  );
  insert into public.actividades (tipo, cliente_id, titulo, descripcion, asignados)
  values (
    'nota',
    v_cliente_id,
    'Pedido #' || v_pedido.id || ' de la landing «' || v_landing.nombre || '»',
    concat_ws(
      E'\n',
      v_resumen,
      'Total: $ ' || v_pedido.total,
      case v_entrega when 'envio' then 'Envío a: ' || v_direccion else 'Retira en el local' end,
      case when v_nota is not null then 'Nota: ' || v_nota end,
      case when coalesce(v_utm ->> 'utm_source', v_utm ->> 'utm_campaign') is not null
        then 'Campaña: ' || concat_ws(' / ', v_utm ->> 'utm_source', v_utm ->> 'utm_campaign') end
    ),
    array[v_responsable]
  );

  v_tarea := btrim(coalesce(v_seguimiento ->> 'taskTitle', ''));
  if v_tarea <> '' then
    v_dias := least(365, greatest(0, coalesce((v_seguimiento ->> 'taskDueInDays')::int, 1)));
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignados)
    values ('tarea', v_cliente_id, left(v_tarea, 200), now() + make_interval(days => v_dias), array[v_responsable]);
  end if;

  insert into public.landing_envios (
    landing_id, landing_slug, cliente_id, tipo, cliente_nuevo, utm_source, utm_campaign, ip_hash
  )
  values (
    v_landing.id, v_slug, v_cliente_id, 'pedido', v_cliente_nuevo,
    left(nullif(btrim(v_utm ->> 'utm_source'), ''), 100),
    left(nullif(btrim(v_utm ->> 'utm_campaign'), ''), 100),
    v_ip_hash
  );

  return jsonb_build_object(
    'pedido_id', v_pedido.id,
    'total', v_pedido.total,
    'lineas', (
      select jsonb_agg(
        jsonb_build_object(
          'nombre', l.valor ->> 'nombre',
          'cantidad', (l.valor ->> 'cantidad')::numeric,
          'precio', (l.valor ->> 'precio_unitario')::numeric,
          'subtotal', (l.valor ->> 'subtotal')::numeric
        ) order by l.posicion
      )
      from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
    )
  );
end;
$$;

-- ============================================================================
-- Seguridad
-- ============================================================================
revoke all on function public.landing_pedido(jsonb) from public;
revoke all on function public.landing_productos(text) from public;
grant execute on function public.landing_pedido(jsonb) to anon, authenticated;
grant execute on function public.landing_productos(text) to anon, authenticated;
