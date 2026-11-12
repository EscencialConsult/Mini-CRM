-- Mini-CRM · el carrito es parte del formulario de la landing.
--
-- Un solo formulario: el visitante completa sus datos y, si el carrito de la
-- landing publicada está activo, elige productos en ese mismo formulario.
-- `landing_recibir` acepta además, de forma opcional:
--   "lineas":   [{"producto_id", "cantidad"}]
--   "entrega":  "envio" | "retiro"
--   "direccion": texto (obligatoria con envío)
-- Con líneas crea el pedido (origen 'landing', precios de la tabla `productos`,
-- nunca del navegador) y devuelve además pedido_id, total y lineas. Sin líneas
-- se comporta igual que antes. `landing_pedido` queda como está, sin uso desde
-- la página. Va después de 20261113100000_landing_carrito.

create or replace function public.landing_recibir(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_datos ->> 'slug', '')));
  v_landing public.landings;
  v_form jsonb;
  v_seguimiento jsonb;
  v_respuestas jsonb := coalesce(p_datos -> 'answers', '{}'::jsonb);
  v_utm jsonb := coalesce(p_datos -> 'utm', '{}'::jsonb);
  v_es_whatsapp boolean := p_datos ->> 'kind' = 'whatsapp';
  v_campo jsonb;
  v_valor text;
  v_tipo text;
  v_destino text;
  v_lineas text[] := '{}';
  v_nombre_completo text;
  v_nombre text;
  v_apellido text;
  v_empresa text;
  v_email text;
  v_telefono text;
  v_digitos text;
  v_palabras text[];
  v_consentimiento text;
  v_ip text;
  v_ip_hash text;
  v_admin uuid;
  v_responsable uuid;
  v_cliente_id bigint;
  v_cliente_nuevo boolean := false;
  v_tarea text;
  v_dias int;
  v_etiquetas bigint[];
  -- Pedido (carrito dentro del formulario)
  v_carrito jsonb;
  v_entrada jsonb := p_datos -> 'lineas';
  v_agrupadas jsonb;
  v_permitidos bigint[];
  v_linea jsonb;
  v_cantidad numeric;
  v_producto_id numeric;
  v_hay_pedido boolean := false;
  v_entrega text := p_datos ->> 'entrega';
  v_direccion text;
  v_pedido public.pedidos;
  v_resumen text;
begin
  -- Solo los bots completan el campo trampa: reciben un ok y no se guarda nada
  if coalesce(p_datos ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;
  if v_slug = '' or jsonb_typeof(v_respuestas) <> 'object' or jsonb_typeof(v_utm) <> 'object' then
    raise exception 'invalid' using errcode = '22023';
  end if;

  -- Una visita nunca crea un cliente ni falla para el visitante
  if p_datos ->> 'event' = 'visit' then
    insert into public.landing_visitas as v (landing_id, dia, visitas)
    select l.id, (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1
    from public.landings l
    where l.slug = v_slug and l.estado = 'publicada'
    on conflict (landing_id, dia) do update set visitas = v.visitas + 1;
    return jsonb_build_object('ok', true);
  end if;

  select * into v_landing from public.landings where slug = v_slug and estado = 'publicada';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- 5 envíos por conexión cada 10 minutos
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
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_form := v_landing.publicada -> 'form';
  v_carrito := v_landing.publicada -> 'carrito';
  v_seguimiento := coalesce(v_landing.publicada -> 'automation', '{}'::jsonb);
  -- Las etiquetas del seguimiento que siguen en el catálogo
  v_etiquetas := array(
    select e.id
    from jsonb_array_elements(
      case when jsonb_typeof(v_seguimiento -> 'tagIds') = 'array' then v_seguimiento -> 'tagIds' else '[]'::jsonb end
    ) as x(valor)
    join public.etiquetas e on jsonb_typeof(x.valor) = 'number' and e.id = (x.valor #>> '{}')::bigint
  );

  if v_es_whatsapp then
    if coalesce((v_landing.publicada -> 'whatsapp' ->> 'enabled')::boolean, false) is not true then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_nombre_completo := left(btrim(coalesce(p_datos ->> 'name', '')), 120);
    v_telefono := left(btrim(coalesce(p_datos ->> 'phone', '')), 40);
    if v_nombre_completo = '' or length(regexp_replace(v_telefono, '\D', '', 'g')) < 6 then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_lineas := array['Pidió hablar por WhatsApp.'];
  else
    -- Cada pregunta, validada contra lo publicado (nunca contra lo que diga el visitante)
    for v_campo in select * from jsonb_array_elements(coalesce(v_form -> 'fields', '[]'::jsonb)) loop
      v_tipo := v_campo ->> 'type';
      v_destino := coalesce(v_campo ->> 'target', 'answer');
      v_valor := privado.texto_respuesta(v_respuestas -> (v_campo ->> 'id'));
      v_valor := left(v_valor, case when v_tipo = 'textarea' then 2000 else 300 end);

      if v_valor = '' then
        if coalesce((v_campo ->> 'required')::boolean, false) then
          raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
        end if;
        continue;
      end if;
      if v_tipo in ('select', 'radio') and not (coalesce(v_campo -> 'options', '[]'::jsonb) ? v_valor) then
        raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
      end if;
      if (v_tipo = 'email' or v_destino = 'email') and v_valor !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
      end if;
      if (v_tipo = 'phone' or v_destino = 'phone') and length(regexp_replace(v_valor, '\D', '', 'g')) not between 6 and 15 then
        raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
      end if;

      case v_destino
        when 'full_name' then v_nombre_completo := v_valor;
        when 'first_name' then v_nombre := v_valor;
        when 'last_name' then v_apellido := v_valor;
        when 'email' then v_email := lower(v_valor);
        when 'phone' then v_telefono := v_valor;
        when 'company' then v_empresa := v_valor;
        else null;
      end case;
      if v_destino not in ('full_name', 'first_name', 'last_name', 'email', 'phone') then
        v_lineas := v_lineas || ((v_campo ->> 'label') || ': ' || v_valor);
      end if;
    end loop;

    if coalesce((v_form -> 'consent' ->> 'enabled')::boolean, true)
       and btrim(coalesce(v_form -> 'consent' ->> 'text', '')) <> '' then
      if coalesce(p_datos ->> 'consent', 'false') <> 'true' then
        raise exception 'invalid' using errcode = '22023', detail = 'consent';
      end if;
      v_consentimiento := v_form -> 'consent' ->> 'text';
    end if;

    -- Pedido opcional: sin líneas es solo una consulta, como siempre
    if v_entrada is not null and v_entrada <> 'null'::jsonb then
      if jsonb_typeof(v_entrada) <> 'array' then
        raise exception 'Hay un producto del pedido con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
      end if;
      v_hay_pedido := jsonb_array_length(v_entrada) > 0;
    end if;

    if v_hay_pedido then
      if coalesce((v_carrito ->> 'activo')::boolean, false) is not true then
        raise exception 'El pedido no está disponible en esta página' using errcode = '22023', hint = 'landing_pedido';
      end if;
      if jsonb_array_length(v_entrada) > 30 then
        raise exception 'El pedido admite hasta 30 productos distintos' using errcode = '22023', hint = 'landing_pedido';
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

      -- Cantidades enteras de 1 a 99
      for v_linea in select value from jsonb_array_elements(v_entrada) loop
        if jsonb_typeof(v_linea) is distinct from 'object'
           or jsonb_typeof(v_linea -> 'producto_id') is distinct from 'number'
           or jsonb_typeof(v_linea -> 'cantidad') is distinct from 'number' then
          raise exception 'Hay un producto del pedido con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
        end if;
        v_producto_id := (v_linea ->> 'producto_id')::numeric;
        v_cantidad := (v_linea ->> 'cantidad')::numeric;
        if v_producto_id <> trunc(v_producto_id) or v_producto_id < 1 or v_producto_id > 9007199254740991 then
          raise exception 'Hay un producto del pedido con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
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
        raise exception 'Alguno de los productos ya no está disponible: actualizá la página y elegí de nuevo'
          using errcode = '22023', hint = 'landing_pedido';
      end if;

      -- Para un pedido hace falta cómo contactar al cliente
      if v_nombre_completo is null and v_nombre is null and v_email is null and v_telefono is null then
        raise exception 'Completá tus datos de contacto para hacer el pedido' using errcode = '22023', hint = 'landing_pedido';
      end if;
    end if;
  end if;

  -- "Juan Pablo Pérez": el apellido es la última palabra
  if v_nombre is null and v_nombre_completo is not null then
    v_palabras := regexp_split_to_array(btrim(regexp_replace(v_nombre_completo, '\s+', ' ', 'g')), ' ');
    if array_length(v_palabras, 1) > 1 then
      v_nombre := array_to_string(v_palabras[1:array_length(v_palabras, 1) - 1], ' ');
      v_apellido := coalesce(v_apellido, v_palabras[array_length(v_palabras, 1)]);
    else
      v_nombre := v_palabras[1];
    end if;
  end if;

  v_digitos := nullif(regexp_replace(coalesce(v_telefono, ''), '\D', '', 'g'), '');
  if length(v_digitos) < 8 then
    v_digitos := null;
  end if;

  -- El mismo cliente si coincide el email o el teléfono (últimos 10 dígitos)
  select c.id into v_cliente_id
  from public.clientes c
  where (v_email is not null and lower(c.email) = v_email)
     or (
       v_digitos is not null
       and length(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g')) >= 8
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
    insert into public.clientes (tipo, nombre, apellido, razon_social, email, telefono, direccion, asignado_a, landing_id, etiquetas)
    values (
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then 'empresa' else 'persona' end,
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then null
           else coalesce(nullif(v_nombre, ''), v_email, v_telefono, 'Sin nombre') end,
      nullif(v_apellido, ''),
      case when coalesce(v_nombre, '') = '' then v_empresa end,
      v_email,
      nullif(v_telefono, ''),
      v_direccion,
      v_admin,
      v_landing.id,
      v_etiquetas
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

    -- Suma las de la landing a las que ya tenía
    update public.clientes
    set etiquetas = etiquetas || v_etiquetas
    where id = v_cliente_id and not etiquetas @> v_etiquetas;
  end if;

  if v_consentimiento is not null then
    v_lineas := v_lineas || ('Aceptó: ' || v_consentimiento);
  end if;
  if coalesce(v_utm ->> 'utm_source', v_utm ->> 'utm_campaign') is not null then
    v_lineas := v_lineas || ('Campaña: ' || concat_ws(' / ', v_utm ->> 'utm_source', v_utm ->> 'utm_campaign'));
  end if;

  insert into public.actividades (tipo, cliente_id, titulo, descripcion, asignados)
  values (
    'nota',
    v_cliente_id,
    case when v_es_whatsapp then 'WhatsApp desde la landing «' else 'Formulario de la landing «' end
      || v_landing.nombre || '»',
    nullif(array_to_string(v_lineas, E'\n'), ''),
    array[v_responsable]
  );

  v_tarea := btrim(coalesce(v_seguimiento ->> 'taskTitle', ''));
  if v_tarea <> '' then
    v_dias := least(365, greatest(0, coalesce((v_seguimiento ->> 'taskDueInDays')::int, 1)));
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignados)
    values ('tarea', v_cliente_id, left(v_tarea, 200), now() + make_interval(days => v_dias), array[v_responsable]);
  end if;

  -- El pedido: los precios los toma la base (pedidos_preparar completa nombre,
  -- precio y subtotal a partir de producto y cantidad)
  if v_hay_pedido then
    insert into public.pedidos (cliente_id, origen, tipo_entrega, direccion, productos)
    values (v_cliente_id, 'landing', v_entrega, v_direccion, v_agrupadas)
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
        case v_entrega when 'envio' then 'Envío a: ' || v_direccion else 'Retira en el local' end
      ),
      array[v_responsable]
    );
  end if;

  insert into public.landing_envios (
    landing_id, landing_slug, cliente_id, tipo, cliente_nuevo,
    consentimiento_en, consentimiento_texto, utm_source, utm_campaign, ip_hash
  )
  values (
    v_landing.id, v_slug, v_cliente_id,
    case when v_es_whatsapp then 'whatsapp' else 'formulario' end,
    v_cliente_nuevo,
    case when v_consentimiento is not null then now() end,
    v_consentimiento,
    left(nullif(btrim(v_utm ->> 'utm_source'), ''), 100),
    left(nullif(btrim(v_utm ->> 'utm_campaign'), ''), 100),
    v_ip_hash
  );

  if v_hay_pedido then
    return jsonb_build_object(
      'ok', true,
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
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Los permisos no cambian: se vuelven a dejar como estaban
revoke all on function public.landing_recibir(jsonb) from public;
grant execute on function public.landing_recibir(jsonb) to anon, authenticated;
