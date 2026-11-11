-- Mini-CRM · etiquetas de clientes.
--
-- Un catálogo (`etiquetas`: nombre único sin importar mayúsculas, y un color de
-- una paleta fija) y, en cada cliente, la lista de las suyas (`clientes.etiquetas`).
-- Cualquier usuario activo crea una etiqueta al escribirla; solo el administrador
-- la renombra, le cambia el color o la borra (y se quita de todos los clientes).
-- Cada landing puede poner etiquetas a los clientes que llegan por ella
-- (`automation.tagIds` del contenido publicado).

-- ============================================================================
-- Catálogo
-- ============================================================================
create table public.etiquetas (
  id bigint generated always as identity primary key,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 40),
  -- Mismos valores que COLORES_ETIQUETA (domain/options.ts)
  color text not null check (
    color in ('gris', 'rojo', 'naranja', 'ambar', 'verde', 'turquesa', 'azul', 'violeta', 'rosa')
  ),
  creado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null
);

create unique index etiquetas_nombre_key on public.etiquetas (lower(nombre));

-- Nombre sin espacios de más; sin color, el siguiente de la paleta
create function public.etiquetas_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  paleta constant text[] := array['azul', 'verde', 'naranja', 'violeta', 'rosa', 'turquesa', 'ambar', 'rojo', 'gris'];
begin
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  if tg_op = 'INSERT' then
    new.creado_por := (select auth.uid());
    new.creado_en := now();
    if new.color is null then
      new.color := paleta[1 + (select count(*) from public.etiquetas) % array_length(paleta, 1)];
    end if;
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  return new;
end;
$$;

create trigger trg_10_etiquetas_preparar
  before insert or update on public.etiquetas
  for each row execute function public.etiquetas_preparar();

-- ============================================================================
-- Etiquetas de cada cliente
-- ============================================================================
alter table public.clientes add column etiquetas bigint[] not null default '{}';
create index clientes_etiquetas_idx on public.clientes using gin (etiquetas);

-- Sin repetidas ni nulas, en el orden en que se pusieron, y todas existentes
create function public.clientes_normalizar_etiquetas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.etiquetas := coalesce(
    array(
      select t.id
      from unnest(new.etiquetas) with ordinality as t(id, posicion)
      where t.id is not null
      group by t.id
      order by min(t.posicion)
    ),
    '{}'::bigint[]
  );
  if exists (
    select 1 from unnest(new.etiquetas) as t(id)
    where not exists (select 1 from public.etiquetas e where e.id = t.id)
  ) then
    raise exception 'Una de las etiquetas ya no existe: recargá la página' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_15_clientes_etiquetas
  before insert or update of etiquetas on public.clientes
  for each row execute function public.clientes_normalizar_etiquetas();

-- Borrar una etiqueta la quita de los clientes (queda en su auditoría)
create function public.etiquetas_quitar_de_clientes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clientes
  set etiquetas = array_remove(etiquetas, old.id)
  where etiquetas @> array[old.id];
  return old;
end;
$$;

create trigger trg_10_etiquetas_quitar_de_clientes
  before delete on public.etiquetas
  for each row execute function public.etiquetas_quitar_de_clientes();

-- ============================================================================
-- Vistas
-- ============================================================================
create view public.etiquetas_resumen with (security_invoker = on) as
select
  e.*,
  (select count(*) from public.clientes c where c.etiquetas @> array[e.id])::int as clientes,
  nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), '') as creado_por_nombre
from public.etiquetas e
left join public.usuarios u on u.id = e.creado_por;

-- `c.*` se expande al crear la vista: se recrea para sumar `etiquetas`, y la
-- búsqueda también encuentra por el nombre de las etiquetas
drop view public.clientes_resumen;
create view public.clientes_resumen with (security_invoker = on) as
select
  c.*,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  coalesce(o.abiertas, 0)::int as oportunidades_abiertas,
  coalesce(o.importe_abierto, 0) as importe_abierto,
  coalesce(a.pendientes, 0)::int as actividades_pendientes,
  a.ultima_actividad,
  public.normalizar_busqueda(concat_ws(' ',
    c.nombre_completo, c.documento, c.email, c.telefono,
    regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), c.direccion,
    (select string_agg(e.nombre, ' ') from public.etiquetas e where e.id = any (c.etiquetas))
  )) as busqueda,
  l.nombre as landing_nombre
from public.clientes c
left join public.usuarios ua on ua.id = c.asignado_a
left join public.usuarios uc on uc.id = c.creado_por
left join public.usuarios um on um.id = c.actualizado_por
left join public.landings l on l.id = c.landing_id
left join lateral (
  select
    count(*) filter (where resultado = 'abierta') as abiertas,
    sum(importe_estimado) filter (where resultado = 'abierta') as importe_abierto
  from public.oportunidades where cliente_id = c.id
) o on true
left join lateral (
  select
    count(*) filter (where not completada) as pendientes,
    max(fecha) filter (where completada) as ultima_actividad
  from public.actividades where cliente_id = c.id
) a on true;

-- ============================================================================
-- Seguridad
-- ============================================================================
alter table public.etiquetas enable row level security;

create policy etiquetas_select on public.etiquetas
  for select to authenticated using ((select public.usuario_activo()));
create policy etiquetas_insert on public.etiquetas
  for insert to authenticated with check ((select public.usuario_activo()));
create policy etiquetas_update on public.etiquetas
  for update to authenticated
  using ((select public.es_administrador())) with check ((select public.es_administrador()));
create policy etiquetas_delete on public.etiquetas
  for delete to authenticated using ((select public.es_administrador()));

grant select, delete on public.etiquetas to authenticated;
grant insert (nombre, color), update (nombre, color) on public.etiquetas to authenticated;
grant select on public.etiquetas_resumen to authenticated;
grant select on public.clientes_resumen to authenticated;

revoke all on function public.etiquetas_preparar() from public, anon, authenticated;
revoke all on function public.clientes_normalizar_etiquetas() from public, anon, authenticated;
revoke all on function public.etiquetas_quitar_de_clientes() from public, anon, authenticated;

-- ============================================================================
-- Landings: las etiquetas elegidas en el seguimiento van al cliente (nuevo o
-- ya conocido); las que se borraron del catálogo se ignoran
-- ============================================================================
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
    insert into public.clientes (tipo, nombre, apellido, razon_social, email, telefono, asignado_a, landing_id, etiquetas)
    values (
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then 'empresa' else 'persona' end,
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then null
           else coalesce(nullif(v_nombre, ''), v_email, v_telefono, 'Sin nombre') end,
      nullif(v_apellido, ''),
      case when coalesce(v_nombre, '') = '' then v_empresa end,
      v_email,
      nullif(v_telefono, ''),
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
