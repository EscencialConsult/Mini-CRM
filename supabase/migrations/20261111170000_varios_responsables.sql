-- Varios responsables por oportunidad y por tarea, todos iguales: la columna
-- asignado_a (uno) pasa a asignados (lista). Una tarea sigue siendo una sola:
-- cualquiera de sus responsables la completa para todos. Los clientes siguen
-- con un único responsable.

-- Las vistas usan asignado_a: se borran y se recrean al final
drop view public.oportunidades_resumen;
drop view public.actividades_resumen;

-- ----------------------------------------------------------------------------
-- Columnas. La copia no dispara triggers: ni autoría ni auditoría cambian
-- ----------------------------------------------------------------------------
alter table public.oportunidades add column asignados uuid[] not null default '{}';
alter table public.actividades add column asignados uuid[] not null default '{}';

alter table public.oportunidades disable trigger user;
alter table public.actividades disable trigger user;
update public.oportunidades set asignados = array[asignado_a] where asignado_a is not null;
update public.actividades set asignados = array[asignado_a] where asignado_a is not null;
alter table public.oportunidades enable trigger user;
alter table public.actividades enable trigger user;

alter table public.oportunidades drop column asignado_a;
alter table public.actividades drop column asignado_a;

-- "Asignadas a mí" busca con @> (contiene)
create index oportunidades_asignados_idx on public.oportunidades using gin (asignados);
create index actividades_asignados_idx on public.actividades using gin (asignados);

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

-- Sin responsables al crear: queda quien la crea
create or replace function public.asignar_por_defecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(new.asignados) = 0 and (select auth.uid()) is not null then
    new.asignados := array[(select auth.uid())];
  end if;
  return new;
end;
$$;

-- Sin repetidos ni nulos (respeta el orden en que se eligieron). Solo se puede
-- sumar a usuarios activos; quien se desactiva sigue en lo que ya tenía.
create function public.normalizar_asignados()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_previos uuid[] := case when tg_op = 'UPDATE' then old.asignados else '{}' end;
begin
  new.asignados := coalesce(
    array(
      select t.id
      from unnest(new.asignados) with ordinality as t(id, orden)
      where t.id is not null
      group by t.id
      order by min(t.orden)
    ),
    '{}'
  );
  if exists (
    select 1
    from unnest(new.asignados) as t(id)
    where t.id <> all (v_previos)
      and not exists (select 1 from public.usuarios u where u.id = t.id and u.activo)
  ) then
    raise exception 'Solo se puede asignar a usuarios activos'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_15_oportunidades_asignados
  before insert or update of asignados on public.oportunidades
  for each row execute function public.normalizar_asignados();
create trigger trg_15_actividades_asignados
  before insert or update of asignados on public.actividades
  for each row execute function public.normalizar_asignados();

-- ----------------------------------------------------------------------------
-- Responsables de varias tareas en un solo pedido: agregar o quitar a alguien
-- sin tocar al resto, o reemplazarlos a todos (sin usuario: sin responsables).
-- Corre con los permisos de quien la llama. Devuelve cuántas cambiaron.
-- ----------------------------------------------------------------------------
create function public.cambiar_responsables_actividades(p_ids bigint[], p_modo text, p_usuario uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_cantidad integer;
begin
  if p_modo not in ('agregar', 'quitar', 'reemplazar')
     or (p_modo <> 'reemplazar' and p_usuario is null) then
    raise exception 'Cambio de responsables inválido' using errcode = '22023';
  end if;

  with nuevos as (
    select
      a.id,
      case p_modo
        when 'agregar' then
          case when p_usuario = any (a.asignados) then a.asignados else a.asignados || p_usuario end
        when 'quitar' then array_remove(a.asignados, p_usuario)
        else case when p_usuario is null then '{}'::uuid[] else array[p_usuario] end
      end as asignados
    from public.actividades a
    where a.id = any (p_ids)
  )
  update public.actividades a
  set asignados = n.asignados
  from nuevos n
  where a.id = n.id and a.asignados is distinct from n.asignados;

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

grant execute on function public.cambiar_responsables_actividades(bigint[], text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Vistas: "asignado_nombre" pasa a ser la lista de nombres ("Ana López, Juan Pérez")
-- ----------------------------------------------------------------------------
create view public.oportunidades_resumen with (security_invoker = on) as
select
  o.*,
  c.nombre_completo as cliente_nombre,
  c.estado as cliente_estado,
  (
    select string_agg(nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), ''), ', ' order by u.nombre, u.apellido)
    from public.usuarios u
    where u.id = any (o.asignados)
  ) as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  public.normalizar_busqueda(concat_ws(' ', o.producto_servicio, c.nombre_completo, o.descripcion)) as busqueda,
  c.tipo as cliente_tipo
from public.oportunidades o
join public.clientes c on c.id = o.cliente_id
left join public.usuarios uc on uc.id = o.creado_por
left join public.usuarios um on um.id = o.actualizado_por;

create view public.actividades_resumen with (security_invoker = on) as
select
  a.*,
  c.nombre_completo as cliente_nombre,
  op.producto_servicio as oportunidad_nombre,
  (
    select string_agg(nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), ''), ', ' order by u.nombre, u.apellido)
    from public.usuarios u
    where u.id = any (a.asignados)
  ) as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  (not a.completada and a.fecha < now()) as vencida,
  public.normalizar_busqueda(concat_ws(' ', a.titulo, c.nombre_completo, a.descripcion)) as busqueda,
  c.tipo as cliente_tipo
from public.actividades a
join public.clientes c on c.id = a.cliente_id
left join public.oportunidades op on op.id = a.oportunidad_id
left join public.usuarios uc on uc.id = a.creado_por
left join public.usuarios um on um.id = a.actualizado_por;

grant select on public.oportunidades_resumen to authenticated;
grant select on public.actividades_resumen to authenticated;

-- ----------------------------------------------------------------------------
-- Recordatorios: las tareas en las que soy uno de los responsables
-- ----------------------------------------------------------------------------
create or replace function public.recordatorios_conteo()
returns jsonb
language sql stable
set search_path = ''
as $$
  with hoy as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d)
  select jsonb_build_object(
    'actividades_vencidas', (
      select count(*) from public.actividades a, hoy
      where not a.completada and (select auth.uid()) = any (a.asignados)
        and (a.fecha at time zone 'America/Argentina/Buenos_Aires')::date < hoy.d
    ),
    'actividades_hoy', (
      select count(*) from public.actividades a, hoy
      where not a.completada and (select auth.uid()) = any (a.asignados)
        and (a.fecha at time zone 'America/Argentina/Buenos_Aires')::date = hoy.d
    ),
    'contactos_vencidos', (
      select count(*) from public.clientes c, hoy
      where c.estado = 'activo' and c.asignado_a = (select auth.uid()) and c.proximo_contacto < hoy.d
    ),
    'contactos_hoy', (
      select count(*) from public.clientes c, hoy
      where c.estado = 'activo' and c.asignado_a = (select auth.uid()) and c.proximo_contacto = hoy.d
    )
  );
$$;


-- ----------------------------------------------------------------------------
-- Landings: la nota y la tarea de seguimiento quedan a cargo del responsable
-- del cliente (o del administrador), como antes, ahora en la lista
-- ----------------------------------------------------------------------------
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
    nullif(current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip', ''),
    nullif(btrim(split_part(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ',', 1)), ''),
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
  v_seguimiento := coalesce(v_landing.publicada -> 'automation', '{}'::jsonb);

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
  where u.rol = 'administrador' and u.activo
  order by coalesce(u.id::text = (v_seguimiento ->> 'adminId'), false) desc, u.creado_en
  limit 1;

  -- Lo que se escribe desde acá queda en la auditoría con este origen
  perform set_config('crm.origen', 'Landing «' || v_landing.nombre || '»', true);

  if v_cliente_id is null then
    insert into public.clientes (tipo, nombre, apellido, razon_social, email, telefono, asignado_a, landing_id)
    values (
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then 'empresa' else 'persona' end,
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then null
           else coalesce(nullif(v_nombre, ''), v_email, v_telefono, 'Sin nombre') end,
      nullif(v_apellido, ''),
      case when coalesce(v_nombre, '') = '' then v_empresa end,
      v_email,
      nullif(v_telefono, ''),
      v_admin,
      v_landing.id
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

  return jsonb_build_object('ok', true);
end;
$$;
