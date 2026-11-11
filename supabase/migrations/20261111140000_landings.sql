-- Mini-CRM · landings: páginas que arma el equipo, sus envíos y sus visitas.
--
-- Los visitantes (anon) solo usan dos funciones: `landing_publica` (lee la versión
-- publicada) y `landing_recibir` (formulario, botón de WhatsApp y visitas). Cada
-- envío crea o reconoce un cliente, le deja una nota con las respuestas y una
-- tarea de seguimiento, todo asignado a un administrador.
-- Publicar pasa por `landing_publicar` / `landing_despublicar`.

-- ============================================================================
-- Ajustes privados (fuera del esquema expuesto por la API)
-- ============================================================================
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table privado.ajustes (
  clave text primary key,
  valor text not null
);

-- Sal del hash de IP: cuenta envíos por conexión sin guardar ninguna IP
insert into privado.ajustes (clave, valor)
values ('ip_sal', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

-- ============================================================================
-- Tablas
-- ============================================================================
create table public.landings (
  id bigint generated always as identity primary key,
  nombre text not null check (btrim(nombre) <> ''),
  -- La ruta pública: <VITE_LANDINGS_URL>/<slug>
  slug text not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada')),
  -- Lo que se edita; los visitantes solo reciben `publicada`
  borrador jsonb not null default '{}'::jsonb check (jsonb_typeof(borrador) = 'object'),
  publicada jsonb,
  publicada_en timestamptz,
  publicada_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  actualizado_por uuid references public.usuarios (id) on delete set null,
  -- Mismo patrón y nombres reservados que `isValidSlug` (landings/pagina/schema.ts)
  constraint landings_slug_valido check (
    slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    and slug <> all (array['crm', 'www', 'mail', 'bounce', 'api', 'admin', 'app', 'smtp', 'ftp', 'webmail', 'ns1', 'ns2'])
  ),
  constraint landings_publicada_con_contenido check (estado <> 'publicada' or publicada is not null)
);

create unique index landings_slug_key on public.landings (slug);

-- Un envío por formulario o pedido de WhatsApp: prueba de consentimiento y límite por IP
create table public.landing_envios (
  id bigint generated always as identity primary key,
  landing_id bigint references public.landings (id) on delete set null,
  -- Aparte del id: la prueba de consentimiento sobrevive a borrar la landing
  landing_slug text not null,
  cliente_id bigint references public.clientes (id) on delete set null,
  tipo text not null check (tipo in ('formulario', 'whatsapp')),
  cliente_nuevo boolean not null,
  consentimiento_en timestamptz,
  consentimiento_texto text,
  utm_source text,
  utm_campaign text,
  ip_hash text not null,
  creado_en timestamptz not null default now()
);

create index landing_envios_landing_idx on public.landing_envios (landing_id, creado_en desc);
create index landing_envios_cliente_idx on public.landing_envios (cliente_id);
create index landing_envios_ip_idx on public.landing_envios (ip_hash, creado_en desc);

-- Visitas por día y nada más: sin IP ni cookies
create table public.landing_visitas (
  landing_id bigint not null references public.landings (id) on delete cascade,
  dia date not null,
  visitas integer not null default 0,
  primary key (landing_id, dia)
);

-- Landing por la que llegó el cliente (la primera vez)
alter table public.clientes
  add column landing_id bigint references public.landings (id) on delete set null;
create index clientes_landing_idx on public.clientes (landing_id) where landing_id is not null;

-- Quien llega por una landing puede dejar solo su nombre: el apellido se completa
-- al editar la ficha (el formulario del CRM lo sigue pidiendo)
alter table public.clientes drop constraint clientes_identidad;
alter table public.clientes add constraint clientes_identidad check (
  (tipo = 'empresa' and nullif(btrim(razon_social), '') is not null)
  or (tipo = 'persona' and nullif(btrim(nombre), '') is not null)
);

-- ============================================================================
-- Auditoría: landings, publicar / despublicar y el origen de lo que hace el sistema
-- ============================================================================
alter table public.auditoria drop constraint auditoria_entidad_check;
alter table public.auditoria add constraint auditoria_entidad_check
  check (entidad in ('clientes', 'oportunidades', 'actividades', 'usuarios', 'landings'));
alter table public.auditoria drop constraint auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check
  check (accion in ('crear', 'editar', 'eliminar', 'activar', 'desactivar', 'cambiar_rol', 'restablecer_clave', 'publicar', 'despublicar'));
-- Sin usuario (un visitante de una landing): de dónde vino el cambio
alter table public.auditoria add column origen text;

-- La vista expande `au.*` al crearse: se recrea para sumar `origen` (y buscar por él)
drop view public.auditoria_resumen;
create view public.auditoria_resumen with (security_invoker = on) as
select
  au.*,
  nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), '') as usuario_nombre,
  public.normalizar_busqueda(concat_ws(' ', au.descripcion, u.nombre, u.apellido, au.origen)) as busqueda
from public.auditoria au
left join public.usuarios u on u.id = au.usuario_id;
grant select on public.auditoria_resumen to authenticated;

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  fila jsonb;
  antes jsonb;
  diferencias jsonb;
  v_accion text;
begin
  if tg_op = 'INSERT' then
    fila := to_jsonb(new);
    v_accion := 'crear';
    diferencias := fila;
  elsif tg_op = 'DELETE' then
    fila := to_jsonb(old);
    v_accion := 'eliminar';
    diferencias := fila;
  else
    antes := to_jsonb(old);
    fila := to_jsonb(new);
    v_accion := 'editar';
    select coalesce(
             jsonb_object_agg(n.key, jsonb_build_object('antes', antes -> n.key, 'despues', n.value)),
             '{}'::jsonb
           )
      into diferencias
      from jsonb_each(fila) as n
     where n.key not in ('actualizado_en', 'actualizado_por')
       and (antes -> n.key) is distinct from n.value;
    -- Un UPDATE que no cambió nada no se registra
    if diferencias = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.auditoria (usuario_id, entidad, registro_id, cliente_id, accion, descripcion, cambios, origen)
  values (
    (select auth.uid()),
    tg_table_name,
    fila ->> 'id',
    case when tg_table_name = 'clientes' then (fila ->> 'id')::bigint else (fila ->> 'cliente_id')::bigint end,
    v_accion,
    coalesce(fila ->> 'nombre_completo', fila ->> 'producto_servicio', fila ->> 'titulo'),
    diferencias,
    nullif(current_setting('crm.origen', true), '')
  );
  return null;
end;
$$;

-- Landings: alta, baja, publicación y cambios de nombre o dirección. Los guardados
-- automáticos del borrador no se registran (serían cientos por landing).
create function public.landings_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_nombre text;
  v_accion text;
  v_cambios jsonb;
begin
  if tg_op = 'INSERT' then
    v_id := new.id;
    v_nombre := new.nombre;
    v_accion := 'crear';
    v_cambios := jsonb_build_object('nombre', new.nombre, 'slug', new.slug);
  elsif tg_op = 'DELETE' then
    v_id := old.id;
    v_nombre := old.nombre;
    v_accion := 'eliminar';
    v_cambios := jsonb_build_object('nombre', old.nombre, 'slug', old.slug, 'estado', old.estado);
  else
    v_id := new.id;
    v_nombre := new.nombre;
    if new.estado = 'publicada' and new.publicada_en is distinct from old.publicada_en then
      v_accion := 'publicar';
    elsif new.estado = 'borrador' and old.estado = 'publicada' then
      v_accion := 'despublicar';
    elsif new.nombre is distinct from old.nombre or new.slug is distinct from old.slug then
      v_accion := 'editar';
      select jsonb_object_agg(k, jsonb_build_object('antes', a, 'despues', d))
        into v_cambios
        from (values ('nombre', to_jsonb(old.nombre), to_jsonb(new.nombre)),
                     ('slug', to_jsonb(old.slug), to_jsonb(new.slug))) as c(k, a, d)
       where a is distinct from d;
    else
      return null;
    end if;
  end if;

  insert into public.auditoria (usuario_id, entidad, registro_id, accion, descripcion, cambios)
  values ((select auth.uid()), 'landings', v_id::text, v_accion, v_nombre, v_cambios);
  return null;
end;
$$;

-- Una landing publicada no cambia de dirección: puede haber anuncios apuntando ahí
create function public.landings_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'publicada' and new.slug is distinct from old.slug then
    raise exception 'Despublicá la landing para cambiar su dirección'
      using errcode = '42501', hint = 'landing_slug_bloqueado';
  end if;
  return new;
end;
$$;

create trigger trg_10_landings_proteger
  before update on public.landings
  for each row execute function public.landings_proteger();
create trigger trg_20_landings_autoria
  before insert or update on public.landings
  for each row execute function public.sellar_autoria();
create trigger trg_90_landings_auditoria
  after insert or update or delete on public.landings
  for each row execute function public.landings_auditoria();

-- ============================================================================
-- Vista de clientes: se agrega la landing de origen (al final, por eso se recrea)
-- ============================================================================
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
    regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), c.direccion
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
-- Funciones para visitantes
-- ============================================================================

-- La versión publicada, sin el seguimiento interno (responsable y tarea)
create function public.landing_publica(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('id', id, 'nombre', nombre, 'slug', slug, 'contenido', publicada - 'automation')
  from public.landings
  where slug = lower(btrim(p_slug)) and estado = 'publicada'
$$;

-- Texto de una respuesta: "" si no hay; las casillas, unidas por coma
create function privado.texto_respuesta(p_valor jsonb)
returns text
language sql immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_valor)
    when 'string' then btrim(p_valor #>> '{}')
    when 'array' then (
      select coalesce(string_agg(btrim(e), ', '), '')
      from jsonb_array_elements_text(p_valor) as e
      where btrim(e) <> ''
    )
    else ''
  end
$$;

/**
 * Recibe todo lo que manda una landing publicada:
 *  · {"slug", "event": "visit"}: suma una visita del día.
 *  · {"slug", "answers": {campo: valor}, "consent", "utm", "website"}: el formulario.
 *  · {"slug", "kind": "whatsapp", "name", "phone", "utm", "website"}: el botón de WhatsApp.
 * Errores (en `message`): not_found, rate_limited, invalid.
 */
create function public.landing_recibir(p_datos jsonb)
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

  insert into public.actividades (tipo, cliente_id, titulo, descripcion, asignado_a)
  values (
    'nota',
    v_cliente_id,
    case when v_es_whatsapp then 'WhatsApp desde la landing «' else 'Formulario de la landing «' end
      || v_landing.nombre || '»',
    nullif(array_to_string(v_lineas, E'\n'), ''),
    v_responsable
  );

  v_tarea := btrim(coalesce(v_seguimiento ->> 'taskTitle', ''));
  if v_tarea <> '' then
    v_dias := least(365, greatest(0, coalesce((v_seguimiento ->> 'taskDueInDays')::int, 1)));
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignado_a)
    values ('tarea', v_cliente_id, left(v_tarea, 200), now() + make_interval(days => v_dias), v_responsable);
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

-- ============================================================================
-- Funciones del CRM (usuarios activos)
-- ============================================================================

-- Copia el borrador a la versión publicada. Lo que falta para publicar lo valida
-- el editor (findPublishProblems); acá solo que la landing exista y el permiso.
create function public.landing_publicar(p_id bigint)
returns public.landings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_landing public.landings;
begin
  if not (select public.usuario_activo()) then
    raise exception 'No tenés permiso para publicar landings' using errcode = '42501';
  end if;
  update public.landings
     set estado = 'publicada', publicada = borrador, publicada_en = now(), publicada_por = (select auth.uid())
   where id = p_id
  returning * into v_landing;
  if not found then
    raise exception 'La landing no existe' using errcode = 'P0002';
  end if;
  return v_landing;
end;
$$;

-- Deja de responder en su dirección; la última versión publicada se conserva
create function public.landing_despublicar(p_id bigint)
returns public.landings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_landing public.landings;
begin
  if not (select public.usuario_activo()) then
    raise exception 'No tenés permiso para despublicar landings' using errcode = '42501';
  end if;
  update public.landings set estado = 'borrador' where id = p_id
  returning * into v_landing;
  if not found then
    raise exception 'La landing no existe' using errcode = 'P0002';
  end if;
  return v_landing;
end;
$$;

-- Resultados de una landing en los últimos p_dias días (hora de Argentina).
-- Corre como quien consulta: RLS decide qué se cuenta.
create function public.landing_estadisticas(p_landing_id bigint, p_dias int default 30)
returns jsonb
language sql stable
set search_path = ''
as $$
  with periodo as (
    select greatest(1, least(coalesce(p_dias, 30), 365)) as dias,
           (now() at time zone 'America/Argentina/Buenos_Aires')::date as hoy
  ),
  calendario as (
    select (periodo.hoy - d)::date as dia
    from periodo, generate_series(0, periodo.dias - 1) as d
  ),
  recibidos as (
    select e.*, (e.creado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia
    from public.landing_envios e, periodo
    where e.landing_id = p_landing_id
      and (e.creado_en at time zone 'America/Argentina/Buenos_Aires')::date > periodo.hoy - periodo.dias
  ),
  ganadas as (
    select o.cliente_id, o.importe_estimado
    from public.oportunidades o
    where o.resultado = 'ganada' and o.cliente_id in (select cliente_id from recibidos)
  )
  select jsonb_build_object(
    'dias', (select dias from periodo),
    'visitas', coalesce((
      select sum(v.visitas) from public.landing_visitas v
      where v.landing_id = p_landing_id and v.dia in (select dia from calendario)
    ), 0),
    'envios', (select count(*) from recibidos),
    'clientes_nuevos', (select count(*) from recibidos where cliente_nuevo),
    'ventas', (select count(distinct cliente_id) from ganadas),
    'importe_ganado', coalesce((select sum(importe_estimado) from ganadas), 0),
    'ultimo_envio', (
      select max(e.creado_en) from public.landing_envios e where e.landing_id = p_landing_id
    ),
    'por_dia', (
      select jsonb_agg(jsonb_build_object(
        'dia', cal.dia,
        'visitas', coalesce((
          select v.visitas from public.landing_visitas v
          where v.landing_id = p_landing_id and v.dia = cal.dia
        ), 0),
        'envios', (select count(*) from recibidos r where r.dia = cal.dia)
      ) order by cal.dia)
      from calendario cal
    ),
    'fuentes', coalesce((
      select jsonb_agg(jsonb_build_object('etiqueta', etiqueta, 'envios', total) order by total desc, etiqueta)
      from (
        select coalesce(utm_source, '') as etiqueta, count(*) as total
        from recibidos group by 1 order by 2 desc limit 8
      ) t
    ), '[]'::jsonb),
    'campanias', coalesce((
      select jsonb_agg(jsonb_build_object('etiqueta', etiqueta, 'envios', total) order by total desc, etiqueta)
      from (
        select coalesce(utm_campaign, '') as etiqueta, count(*) as total
        from recibidos group by 1 order by 2 desc limit 8
      ) t
    ), '[]'::jsonb),
    'recientes', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.creado_en desc)
      from (
        select r.cliente_id, c.nombre_completo as cliente_nombre, r.tipo, r.cliente_nuevo,
               r.utm_source, r.utm_campaign, r.creado_en
        from recibidos r
        left join public.clientes c on c.id = r.cliente_id
        order by r.creado_en desc limit 8
      ) t
    ), '[]'::jsonb)
  )
$$;

-- Las mismas cifras para el listado de landings
create function public.landings_indicadores(p_dias int default 30)
returns table (landing_id bigint, visitas bigint, envios bigint, ventas bigint, ultimo_envio timestamptz)
language sql stable
set search_path = ''
as $$
  with periodo as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date
           - greatest(1, least(coalesce(p_dias, 30), 365)) as antes
  )
  select
    l.id,
    coalesce((
      select sum(v.visitas) from public.landing_visitas v, periodo
      where v.landing_id = l.id and v.dia > periodo.antes
    ), 0)::bigint,
    (
      select count(*) from public.landing_envios e, periodo
      where e.landing_id = l.id
        and (e.creado_en at time zone 'America/Argentina/Buenos_Aires')::date > periodo.antes
    ),
    (
      select count(distinct o.cliente_id)
      from public.landing_envios e
      join public.oportunidades o on o.cliente_id = e.cliente_id and o.resultado = 'ganada',
      periodo
      where e.landing_id = l.id
        and (e.creado_en at time zone 'America/Argentina/Buenos_Aires')::date > periodo.antes
    ),
    (select max(e.creado_en) from public.landing_envios e where e.landing_id = l.id)
  from public.landings l
$$;

-- ============================================================================
-- Seguridad
-- ============================================================================
alter table public.landings enable row level security;
alter table public.landing_envios enable row level security;
alter table public.landing_visitas enable row level security;

-- Administradores y vendedores activos crean, editan y publican; solo el
-- administrador elimina, y nunca una landing publicada
create policy landings_select on public.landings
  for select to authenticated using ((select public.usuario_activo()));
create policy landings_insert on public.landings
  for insert to authenticated with check ((select public.usuario_activo()));
create policy landings_update on public.landings
  for update to authenticated
  using ((select public.usuario_activo())) with check ((select public.usuario_activo()));
create policy landings_delete on public.landings
  for delete to authenticated
  using ((select public.es_administrador()) and estado <> 'publicada');

-- Envíos y visitas: los escriben solo las funciones de arriba
create policy landing_envios_select on public.landing_envios
  for select to authenticated using ((select public.usuario_activo()));
create policy landing_visitas_select on public.landing_visitas
  for select to authenticated using ((select public.usuario_activo()));

-- El cliente solo escribe nombre, dirección y borrador: publicar va por función
grant select, delete on public.landings to authenticated;
grant insert (nombre, slug, borrador), update (nombre, slug, borrador) on public.landings to authenticated;
grant select on public.landing_envios to authenticated;
grant select on public.landing_visitas to authenticated;
grant select on public.clientes_resumen to authenticated;

revoke all on function public.landings_auditoria() from public, anon, authenticated;
revoke all on function public.landings_proteger() from public, anon, authenticated;
revoke all on function privado.texto_respuesta(jsonb) from public, anon, authenticated;
grant execute on function public.landing_publica(text) to anon, authenticated;
grant execute on function public.landing_recibir(jsonb) to anon, authenticated;
grant execute on function public.landing_publicar(bigint) to authenticated;
grant execute on function public.landing_despublicar(bigint) to authenticated;
grant execute on function public.landing_estadisticas(bigint, int) to authenticated;
grant execute on function public.landings_indicadores(int) to authenticated;

-- ============================================================================
-- Imágenes de las landings: públicas porque las cargan los visitantes
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing-imagenes', 'landing-imagenes', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy landing_imagenes_select on storage.objects
  for select to authenticated
  using (bucket_id = 'landing-imagenes' and (select public.usuario_activo()));
create policy landing_imagenes_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'landing-imagenes' and (select public.usuario_activo()));
create policy landing_imagenes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'landing-imagenes' and (select public.usuario_activo()));
