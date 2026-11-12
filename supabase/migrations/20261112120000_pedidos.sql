-- Mini-CRM · Pedidos (módulo WhatsApp, fase 1 de WHATSAPP.md).
--
-- Un pedido lo registra el bot de WhatsApp (el VPS, con la clave de servicio)
-- o alguien del equipo con el módulo Pedidos. Lleva cliente, líneas de
-- productos (mismo formato que las oportunidades), entrega (envío o retiro,
-- dirección y fecha y hora opcional: sin fecha es "para ahora") y un estado:
-- Nuevo → En preparación → En camino (envío) / Listo para retirar (retiro) →
-- Entregado, o Cancelado.
--
-- Al marcarse Entregado se crea la venta: una oportunidad ganada enlazada al
-- pedido, así Ventas, el Panel y el ranking la cuentan sin cambios. Si vino por
-- WhatsApp lleva el canal WhatsApp y el responsable es el usuario del sistema
-- "Bot WhatsApp"; si la cargó el equipo, el canal del cliente y quien la
-- entrega. Esa venta no se edita a mano: al salir de Entregado (con motivo
-- obligatorio) se elimina sola. Las ventas de pedidos no entran en el ciclo
-- promedio ni en la tasa de cierre, que miden el embudo de oportunidades.
--
-- Cada cambio de estado queda en `pedido_historial`. Si el pedido vino por
-- WhatsApp deja además un aviso en `pedido_avisos`, que el VPS le manda al
-- comprador solo si su ventana de 24 h sigue abierta. El estado se cambia con
-- `pedido_cambiar_estado`, que lleva el motivo.
-- Va después de 20261112110000_ventas.

-- ============================================================================
-- Usuario del sistema "Bot WhatsApp"
-- ============================================================================
-- Responsable de las ventas que llegan por WhatsApp (aparece en el ranking).
-- Su cuenta de acceso no tiene clave y está bloqueada: nadie inicia sesión con
-- ella. No se asigna a clientes, oportunidades ni tareas, y no se modifica ni
-- se borra.
alter table public.usuarios add column sistema boolean not null default false;

with cuenta as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, banned_until
  )
  values (
    coalesce(
      (select u.instance_id from auth.users u where u.instance_id is not null limit 1),
      '00000000-0000-0000-0000-000000000000'
    ),
    gen_random_uuid(), 'authenticated', 'authenticated', 'bot-whatsapp@sistema.invalid', '', now(),
    '', '', '', '',
    '{"provider": "email", "providers": ["email"]}', '{"nombre": "Bot", "apellido": "WhatsApp"}',
    now(), now(), '2999-12-31'
  )
  returning id, email
)
insert into public.usuarios (id, nombre, apellido, email, rol, activo, modulos, sistema)
select id, 'Bot', 'WhatsApp', email, 'vendedor', true, '{}', true from cuenta;

create function public.usuario_bot()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.id from public.usuarios u where u.sistema and u.email = 'bot-whatsapp@sistema.invalid';
$$;

-- No se modifica ni se borra (tampoco por la Edge Function `users`)
create or replace function public.usuarios_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quedaria_sin_admin boolean;
begin
  if old.sistema then
    raise exception '«% %» es un usuario del sistema: no se modifica ni se borra', old.nombre, old.apellido
      using errcode = '42501';
  end if;

  quedaria_sin_admin := old.rol = 'administrador' and old.activo
    and not exists (
      select 1 from public.usuarios u
      where u.id <> old.id and u.rol = 'administrador' and u.activo
    );

  if tg_op = 'DELETE' then
    if quedaria_sin_admin then
      raise exception 'Debe quedar al menos un administrador activo' using errcode = 'P0001';
    end if;
    return old;
  end if;

  new.actualizado_en := now();
  if quedaria_sin_admin and (new.rol <> 'administrador' or not new.activo) then
    raise exception 'Debe quedar al menos un administrador activo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Los clientes no se asignan al bot
create or replace function public.clientes_asignacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if new.asignado_a is not null
     and (tg_op = 'INSERT' or new.asignado_a is distinct from old.asignado_a)
     and exists (select 1 from public.usuarios u where u.id = new.asignado_a and u.sistema) then
    raise exception 'Los clientes no se asignan al bot' using errcode = '23514';
  end if;

  -- Sin sesión (servicio / migraciones) no se restringe
  if uid is null or (select public.es_administrador()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.asignado_a is not null and new.asignado_a <> uid then
      raise exception 'Solo un administrador puede asignar clientes a otro usuario'
        using errcode = '42501';
    end if;
    new.asignado_a := uid;
  elsif new.asignado_a is distinct from old.asignado_a then
    raise exception 'Solo un administrador puede reasignar clientes'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Oportunidades y tareas: el bot solo lo pone el sistema (la venta de un
-- pedido, desde un trigger: profundidad 2), nunca una persona
create or replace function public.normalizar_asignados()
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
  if pg_trigger_depth() < 2 and exists (
    select 1
    from unnest(new.asignados) as t(id)
    where t.id <> all (v_previos)
      and exists (select 1 from public.usuarios u where u.id = t.id and u.sistema)
  ) then
    raise exception 'El bot no se puede asignar' using errcode = '23514';
  end if;
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

-- ============================================================================
-- Canal del sistema "WhatsApp" (ventas del bot y clientes que crea): pasa a
-- tener clave, así no se borra. Sin triggers: canales_preparar no deja cambiar
-- la clave.
-- ============================================================================
alter table public.canales disable trigger user;
update public.canales
set clave = 'whatsapp'
where id = (
  select id from public.canales where lower(nombre) = 'whatsapp' and clave is null order by id limit 1
);
alter table public.canales enable trigger user;

insert into public.canales (nombre, clave)
select 'WhatsApp', 'whatsapp'
where not exists (select 1 from public.canales where clave = 'whatsapp');

-- ============================================================================
-- Líneas de productos: las arman igual las oportunidades y los pedidos
-- ============================================================================
-- Valida cada línea, completa nombre y subtotal, y devuelve el total y el
-- título ("A", "A y B", "A y 2 más"). Un producto inactivo solo puede quedar si
-- ya estaba (`p_previas`) o si se permite (la venta de un pedido conserva lo
-- que se entregó).
create function public.armar_lineas(
  p_lineas jsonb,
  p_previas jsonb,
  p_con_inactivos boolean,
  out lineas jsonb,
  out total numeric,
  out titulo text
)
language plpgsql stable
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_producto public.productos;
  v_nombres text[] := '{}';
  v_cantidad numeric;
  v_precio numeric;
  v_descuento numeric;
  v_subtotal numeric;
begin
  lineas := '[]';
  total := 0;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agregá al menos un producto' using errcode = '23514';
  end if;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    select * into v_producto
    from public.productos
    where id = (v_linea ->> 'producto_id')::bigint;
    if not found then
      raise exception 'Uno de los productos ya no existe' using errcode = '23503';
    end if;
    if not v_producto.activo and not p_con_inactivos and not coalesce(
      p_previas @> jsonb_build_array(jsonb_build_object('producto_id', v_producto.id)), false
    ) then
      raise exception 'El producto «%» está inactivo', v_producto.nombre using errcode = '23514';
    end if;

    v_cantidad := coalesce((v_linea ->> 'cantidad')::numeric, 1);
    v_precio := coalesce((v_linea ->> 'precio_unitario')::numeric, v_producto.precio);
    v_descuento := coalesce((v_linea ->> 'descuento')::numeric, 0);
    if v_cantidad <= 0 or v_precio < 0 or v_descuento < 0 or v_descuento > 100 then
      raise exception 'Revisá cantidad, precio y descuento de «%»', v_producto.nombre
        using errcode = '23514';
    end if;

    v_subtotal := round(v_cantidad * v_precio * (1 - v_descuento / 100), 2);
    total := total + v_subtotal;
    v_nombres := v_nombres || v_producto.nombre;
    lineas := lineas || jsonb_build_object(
      'producto_id', v_producto.id,
      'nombre', v_producto.nombre,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'descuento', v_descuento,
      'subtotal', v_subtotal
    );
  end loop;

  titulo := case cardinality(v_nombres)
    when 1 then v_nombres[1]
    when 2 then v_nombres[1] || ' y ' || v_nombres[2]
    else v_nombres[1] || ' y ' || (cardinality(v_nombres) - 1) || ' más'
  end;
end;
$$;

-- ============================================================================
-- Pedidos
-- ============================================================================
create table public.pedidos (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  -- 'whatsapp': lo registró el bot; 'manual': lo cargó el equipo
  origen text not null default 'manual' check (origen in ('whatsapp', 'manual')),
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'en_preparacion', 'en_camino', 'listo_para_retirar', 'entregado', 'cancelado')),
  tipo_entrega text not null default 'envio' check (tipo_entrega in ('envio', 'retiro')),
  direccion text,
  -- Sin fecha: "para ahora"
  entrega_en timestamptz,
  productos jsonb not null default '[]' check (jsonb_typeof(productos) = 'array'),
  total numeric(14, 2) not null default 0 check (total >= 0),
  titulo text not null default '',
  nota text,
  -- Número del comprador en WhatsApp (solo dígitos, formato internacional): a dónde va el aviso
  telefono_whatsapp text check (telefono_whatsapp is null or telefono_whatsapp ~ '^[0-9]{8,15}$'),
  -- La manda el bot: si reintenta, no se duplica el pedido
  clave_idempotencia text unique,
  -- Pedido de prueba (asistente de conexión): no genera venta
  prueba boolean not null default false,
  entregado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  actualizado_por uuid references public.usuarios (id) on delete set null,
  constraint pedidos_direccion check (tipo_entrega <> 'envio' or nullif(btrim(direccion), '') is not null),
  constraint pedidos_estado_entrega check (
    not (estado = 'en_camino' and tipo_entrega = 'retiro')
    and not (estado = 'listo_para_retirar' and tipo_entrega = 'envio')
  ),
  constraint pedidos_entregado check ((estado = 'entregado') = (entregado_en is not null))
);

create index pedidos_cliente_idx on public.pedidos (cliente_id);
create index pedidos_estado_idx on public.pedidos (estado, entrega_en);
create index pedidos_creado_en_idx on public.pedidos (creado_en desc);
create index pedidos_productos_idx on public.pedidos using gin (productos jsonb_path_ops);

-- Cada cambio de estado: quién, cuándo, de cuál a cuál y por qué
create table public.pedido_historial (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos (id) on delete cascade,
  fecha timestamptz not null default now(),
  estado_anterior text,
  estado text not null,
  usuario_id uuid references public.usuarios (id) on delete set null,
  -- Sin usuario (el bot): de dónde vino el cambio
  origen text,
  motivo text
);

create index pedido_historial_pedido_idx on public.pedido_historial (pedido_id, fecha);

-- Avisos al comprador. El VPS toma los pendientes, envía los que caen dentro de
-- la ventana de 24 h y los marca; uno nuevo reemplaza al pendiente anterior.
create table public.pedido_avisos (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos (id) on delete cascade,
  estado_pedido text not null,
  telefono text not null,
  creado_en timestamptz not null default now(),
  resultado text not null default 'pendiente'
    check (resultado in ('pendiente', 'enviado', 'vencido', 'reemplazado', 'error')),
  procesado_en timestamptz,
  detalle text
);

create index pedido_avisos_pedido_idx on public.pedido_avisos (pedido_id);
create index pedido_avisos_pendientes_idx on public.pedido_avisos (creado_en) where resultado = 'pendiente';

-- La venta de un pedido: una por pedido, se va con él
alter table public.oportunidades
  add column pedido_id bigint unique references public.pedidos (id) on delete cascade;

-- ============================================================================
-- Reglas de pedidos
-- ============================================================================

-- Textos, dirección (la del cliente si no se escribe), líneas y total. Entregado
-- o cancelado no se edita: primero se cambia el estado.
create function public.pedidos_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v record;
begin
  if tg_op = 'UPDATE' then
    new.origen := old.origen;
    new.clave_idempotencia := old.clave_idempotencia;
    if old.estado in ('entregado', 'cancelado') and new.estado = old.estado
       and (new.cliente_id, new.tipo_entrega, new.direccion, new.entrega_en, new.productos,
            new.nota, new.telefono_whatsapp, new.prueba)
           is distinct from
           (old.cliente_id, old.tipo_entrega, old.direccion, old.entrega_en, old.productos,
            old.nota, old.telefono_whatsapp, old.prueba) then
      raise exception 'El pedido está %: para editarlo, primero cambiá su estado', old.estado
        using errcode = '23514';
    end if;
  end if;

  new.nota := nullif(btrim(new.nota), '');
  new.telefono_whatsapp := nullif(regexp_replace(coalesce(new.telefono_whatsapp, ''), '\D', '', 'g'), '');
  if new.tipo_entrega = 'retiro' then
    new.direccion := null;
  else
    new.direccion := coalesce(
      nullif(btrim(new.direccion), ''),
      (select nullif(btrim(c.direccion), '') from public.clientes c where c.id = new.cliente_id)
    );
    if new.direccion is null then
      raise exception 'Falta la dirección de entrega' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' or new.productos is distinct from old.productos then
    select * into v from public.armar_lineas(
      new.productos,
      case when tg_op = 'UPDATE' then old.productos end,
      false
    );
    new.productos := v.lineas;
    new.total := v.total;
    new.titulo := v.titulo;
  end if;
  return new;
end;
$$;

-- Estado: empieza en Nuevo; En camino es de envío y Listo para retirar, de
-- retiro. Entregado crea la venta; salir de Entregado pide motivo y la
-- elimina. SECURITY DEFINER: escribe la venta aunque quien entrega no tenga
-- el Tablero. El motivo llega en `crm.motivo_estado` (pedido_cambiar_estado).
create function public.pedidos_estado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_origen text := coalesce(current_setting('crm.origen', true), '');
  v_motivo text := nullif(btrim(current_setting('crm.motivo_estado', true)), '');
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
      perform set_config('crm.origen', 'Pedido #' || new.id, true);
      insert into public.oportunidades (
        cliente_id, productos, canal_id, etapa, resultado, fecha_cierre, asignados, descripcion, pedido_id
      )
      values (
        new.cliente_id,
        new.productos,
        -- Manual: el canal del cliente (oportunidades_canal)
        case when new.origen = 'whatsapp' then (select ca.id from public.canales ca where ca.clave = 'whatsapp') end,
        'negociacion',
        'ganada',
        (new.entregado_en at time zone 'America/Argentina/Buenos_Aires')::date,
        -- Manual: quien lo entrega (asignar_por_defecto)
        case when new.origen = 'whatsapp' then array[public.usuario_bot()] else '{}'::uuid[] end,
        'Pedido #' || new.id,
        new.id
      );
      perform set_config('crm.origen', v_origen, true);
    end if;
  end if;
  return new;
end;
$$;

-- Historial de cada cambio de estado y aviso al comprador si vino por
-- WhatsApp. Cada cambio anula el aviso que siga pendiente (ya no es cierto);
-- volver a Nuevo o corregir una entrega no se le avisa.
create function public.pedidos_seguimiento()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.estado = old.estado then
    return null;
  end if;

  insert into public.pedido_historial (pedido_id, estado_anterior, estado, usuario_id, origen, motivo)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.estado end,
    new.estado,
    (select auth.uid()),
    nullif(current_setting('crm.origen', true), ''),
    nullif(btrim(current_setting('crm.motivo_estado', true)), '')
  );

  if tg_op = 'INSERT' then
    return null;
  end if;

  update public.pedido_avisos
     set resultado = 'reemplazado', procesado_en = now()
   where pedido_id = new.id and resultado = 'pendiente';

  if new.origen = 'whatsapp'
     and new.telefono_whatsapp is not null
     and new.estado <> 'nuevo'
     and old.estado <> 'entregado' then
    insert into public.pedido_avisos (pedido_id, estado_pedido, telefono)
    values (new.id, new.estado, new.telefono_whatsapp);
  end if;
  return null;
end;
$$;

-- Un entregado no se borra: primero se revierte (queda registro). Sí se va
-- cuando se elimina su cliente (profundidad 2: cascada).
create function public.pedidos_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'entregado' and pg_trigger_depth() < 2 then
    raise exception 'El pedido está entregado: revertí la entrega antes de eliminarlo'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger trg_05_pedidos_proteger
  before delete on public.pedidos
  for each row execute function public.pedidos_proteger();
create trigger trg_10_pedidos_preparar
  before insert or update on public.pedidos
  for each row execute function public.pedidos_preparar();
create trigger trg_20_pedidos_estado
  before insert or update on public.pedidos
  for each row execute function public.pedidos_estado();
create trigger trg_30_pedidos_autoria
  before insert or update on public.pedidos
  for each row execute function public.sellar_autoria();
create trigger trg_50_pedidos_seguimiento
  after insert or update of estado on public.pedidos
  for each row execute function public.pedidos_seguimiento();

-- Cambiar el estado (con el motivo, obligatorio para revertir una entrega).
-- SECURITY DEFINER: el estado no se escribe directo desde la API. Sin sesión,
-- solo la clave de servicio (el bot) llega hasta acá.
create function public.pedido_cambiar_estado(p_id bigint, p_estado text, p_motivo text default null)
returns public.pedidos
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  if (select auth.uid()) is not null and not (select public.tiene_modulo('pedidos')) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;
  if p_estado is null or p_estado not in (
    'nuevo', 'en_preparacion', 'en_camino', 'listo_para_retirar', 'entregado', 'cancelado'
  ) then
    raise exception 'Estado de pedido inválido' using errcode = '22023';
  end if;

  perform set_config('crm.motivo_estado', coalesce(btrim(p_motivo), ''), true);
  update public.pedidos set estado = p_estado where id = p_id
  returning * into v_pedido;
  perform set_config('crm.motivo_estado', '', true);

  if v_pedido.id is null then
    raise exception 'El pedido no existe' using errcode = 'P0002';
  end if;
  return v_pedido;
end;
$$;

-- ============================================================================
-- Oportunidades: líneas con la función común y ventas de pedidos protegidas
-- ============================================================================
create or replace function public.oportunidades_productos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v record;
begin
  if tg_op = 'UPDATE' and new.productos is not distinct from old.productos then
    return new;
  end if;
  select * into v from public.armar_lineas(
    new.productos,
    case when tg_op = 'UPDATE' then old.productos end,
    new.pedido_id is not null
  );
  new.productos := v.lineas;
  new.importe_estimado := v.total;
  new.producto_servicio := v.titulo;
  return new;
end;
$$;

-- La venta de un pedido la escriben y la borran solo los triggers de pedidos
-- (profundidad 2) o la cascada al eliminar el cliente o el pedido
create function public.oportunidades_de_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() < 2 then
    if tg_op <> 'INSERT' and old.pedido_id is not null then
      raise exception 'Esta venta viene del pedido #%: se cambia desde Pedidos', old.pedido_id
        using errcode = '42501';
    end if;
    if tg_op <> 'DELETE' and new.pedido_id is not null then
      raise exception 'Solo el sistema vincula ventas con pedidos' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_05_oportunidades_de_pedido
  before insert or update or delete on public.oportunidades
  for each row execute function public.oportunidades_de_pedido();

-- Un producto en pedidos tampoco se borra
create or replace function public.productos_proteger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.oportunidades o
    where o.productos @> jsonb_build_array(jsonb_build_object('producto_id', old.id))
  ) then
    raise exception 'El producto está en oportunidades: desactivalo en vez de borrarlo'
      using errcode = '23503';
  end if;
  if exists (
    select 1 from public.pedidos p
    where p.productos @> jsonb_build_array(jsonb_build_object('producto_id', old.id))
  ) then
    raise exception 'El producto está en pedidos: desactivalo en vez de borrarlo'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

-- ============================================================================
-- Auditoría
-- ============================================================================
alter table public.auditoria drop constraint auditoria_entidad_check;
alter table public.auditoria add constraint auditoria_entidad_check
  check (entidad in ('clientes', 'oportunidades', 'actividades', 'usuarios', 'landings', 'pedidos'));

create trigger trg_90_pedidos_auditoria
  after insert or update or delete on public.pedidos
  for each row execute function public.registrar_auditoria();

-- ============================================================================
-- Ventas: las de pedidos no entran en el ciclo promedio ni en la tasa de
-- cierre (global y por vendedor); en la fila del bot quedan vacías.
-- ============================================================================
create or replace function public.ventas_reporte(
  p_desde date default null,
  p_hasta date default null,
  p_vendedor uuid default null,
  p_canal bigint default null,
  p_producto bigint default null
)
returns jsonb
language sql stable
set search_path = ''
as $$
  with cerradas as (
    select
      o.*,
      case when o.pedido_id is null
        then o.fecha_cierre - (o.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
      end as ciclo,
      (o.resultado = 'ganada' and o.pedido_id is null) as ganada_embudo
    from public.oportunidades o
    where o.resultado in ('ganada', 'perdida')
      and (p_desde is null or o.fecha_cierre >= p_desde)
      and (p_hasta is null or o.fecha_cierre <= p_hasta)
      and (p_vendedor is null or p_vendedor = any (o.asignados))
      and (p_canal is null or o.canal_id = p_canal)
      and (p_producto is null
           or o.productos @> jsonb_build_array(jsonb_build_object('producto_id', p_producto)))
  ),
  ganadas as (
    select * from cerradas where resultado = 'ganada'
  ),
  indicadores as (
    select
      coalesce(sum(importe_estimado) filter (where resultado = 'ganada'), 0) as total_vendido,
      (count(*) filter (where resultado = 'ganada'))::int as ventas,
      (count(*) filter (where ganada_embudo))::int as ventas_embudo,
      (count(*) filter (where resultado = 'perdida'))::int as perdidas,
      coalesce(sum(importe_estimado) filter (where resultado = 'perdida'), 0) as importe_perdido,
      round(avg(ciclo) filter (where resultado = 'ganada'), 1) as ciclo_promedio
    from cerradas
  ),
  por_canal as (
    select
      g.canal_id,
      coalesce(ca.nombre, 'Sin canal') as nombre,
      count(*)::int as ventas,
      sum(g.importe_estimado) as importe
    from ganadas g
    left join public.canales ca on ca.id = g.canal_id
    group by g.canal_id, ca.nombre
  ),
  ranking as (
    select
      r.usuario_id,
      coalesce(nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), ''), 'Otro usuario') as nombre,
      (count(*) filter (where c.resultado = 'ganada'))::int as ventas,
      coalesce(sum(c.importe_estimado) filter (where c.resultado = 'ganada'), 0) as importe,
      (count(*) filter (where c.resultado = 'perdida'))::int as perdidas,
      (count(*) filter (where c.ganada_embudo))::int as ventas_embudo,
      round(avg(c.ciclo) filter (where c.resultado = 'ganada'), 1) as ciclo_promedio
    from cerradas c
    cross join lateral unnest(c.asignados) as r(usuario_id)
    left join public.usuarios u on u.id = r.usuario_id
    where p_vendedor is null or r.usuario_id = p_vendedor
    group by r.usuario_id, u.nombre, u.apellido
  ),
  lineas as (
    select
      (l ->> 'producto_id')::bigint as producto_id,
      l ->> 'nombre' as nombre,
      (l ->> 'cantidad')::numeric as cantidad,
      (l ->> 'subtotal')::numeric as subtotal,
      g.id as oportunidad_id
    from ganadas g
    cross join lateral jsonb_array_elements(g.productos) as l
  ),
  productos as (
    select
      li.producto_id,
      coalesce(p.nombre, max(li.nombre)) as nombre,
      sum(li.cantidad) as cantidad,
      sum(li.subtotal) as importe,
      count(distinct li.oportunidad_id)::int as ventas
    from lineas li
    left join public.productos p on p.id = li.producto_id
    where p_producto is null or li.producto_id = p_producto
    group by li.producto_id, p.nombre
  ),
  motivos as (
    select
      coalesce(motivo_perdida_tipo, 'otro') as motivo,
      count(*)::int as cantidad,
      sum(importe_estimado) as importe
    from cerradas
    where resultado = 'perdida'
    group by 1
  )
  select jsonb_build_object(
    'indicadores', (
      select jsonb_build_object(
        'total_vendido', i.total_vendido,
        'ventas', i.ventas,
        'ticket_promedio', case when i.ventas > 0 then round(i.total_vendido / i.ventas, 2) end,
        'ciclo_promedio', i.ciclo_promedio,
        'perdidas', i.perdidas,
        'importe_perdido', i.importe_perdido,
        'tasa_cierre', case when i.ventas_embudo + i.perdidas > 0
          then round(i.ventas_embudo::numeric / (i.ventas_embudo + i.perdidas), 4) end
      )
      from indicadores i
    ),
    'por_canal', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.importe desc, x.nombre) from por_canal x), '[]'
    ),
    'ranking', coalesce(
      (select jsonb_agg(
         (to_jsonb(x) - 'ventas_embudo') || jsonb_build_object(
           'tasa_cierre', case when x.ventas_embudo + x.perdidas > 0
             then round(x.ventas_embudo::numeric / (x.ventas_embudo + x.perdidas), 4) end
         )
         order by x.importe desc, x.ventas desc, x.nombre)
       from ranking x), '[]'
    ),
    'productos', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.importe desc, x.nombre) from productos x), '[]'
    ),
    'motivos', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.cantidad desc, x.importe desc) from motivos x), '[]'
    )
  );
$$;

-- ============================================================================
-- Módulo Pedidos
-- ============================================================================
alter table public.usuarios drop constraint usuarios_modulos_validos;
alter table public.usuarios add constraint usuarios_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'oportunidades', 'pedidos', 'actividades', 'productos', 'ventas',
    'landings', 'etiquetas', 'auditoria'
  ]::text[]
);

alter table public.usuarios disable trigger user;
update public.usuarios
set modulos = '{panel,clientes,oportunidades,pedidos,actividades,productos,ventas,landings,etiquetas,auditoria}'
where rol = 'administrador' and not sistema;
alter table public.usuarios enable trigger user;

-- Con Pedidos se leen los clientes y los productos que se eligen en un pedido
drop policy clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select to authenticated
  using ((select public.tiene_modulo('clientes', 'oportunidades', 'actividades', 'ventas', 'pedidos')));

drop policy productos_select on public.productos;
create policy productos_select on public.productos
  for select to authenticated
  using ((select public.tiene_modulo('productos', 'oportunidades', 'ventas', 'pedidos')));

-- ============================================================================
-- Vistas (`o.*` se expande al crearla: se recrea para sumar pedido_id)
-- ============================================================================
create view public.pedidos_resumen with (security_invoker = on) as
select
  p.*,
  c.nombre_completo as cliente_nombre,
  c.telefono as cliente_telefono,
  -- La venta enlazada (solo la ve quien tiene Tablero o Ventas)
  (select o.id from public.oportunidades o where o.pedido_id = p.id) as venta_id,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  public.normalizar_busqueda(concat_ws(' ',
    p.id::text, p.titulo, c.nombre_completo, p.direccion, p.nota, p.telefono_whatsapp, c.telefono
  )) as busqueda
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.usuarios uc on uc.id = p.creado_por
left join public.usuarios um on um.id = p.actualizado_por;

drop view public.oportunidades_resumen;
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
  c.tipo as cliente_tipo,
  ca.nombre as canal_nombre
from public.oportunidades o
join public.clientes c on c.id = o.cliente_id
left join public.canales ca on ca.id = o.canal_id
left join public.usuarios uc on uc.id = o.creado_por
left join public.usuarios um on um.id = o.actualizado_por;

-- Las columnas nuevas van al final
create or replace view public.productos_resumen with (security_invoker = on) as
select
  p.*,
  (
    select count(*) from public.oportunidades o
    where o.productos @> jsonb_build_array(jsonb_build_object('producto_id', p.id))
  )::int as oportunidades,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  public.normalizar_busqueda(concat_ws(' ', p.nombre, p.descripcion)) as busqueda,
  (
    select count(*) from public.pedidos pe
    where pe.productos @> jsonb_build_array(jsonb_build_object('producto_id', p.id))
  )::int as pedidos
from public.productos p
left join public.usuarios uc on uc.id = p.creado_por
left join public.usuarios um on um.id = p.actualizado_por;

-- ============================================================================
-- Seguridad
-- ============================================================================
alter table public.pedidos enable row level security;
alter table public.pedido_historial enable row level security;
alter table public.pedido_avisos enable row level security;

create policy pedidos_select on public.pedidos
  for select to authenticated using ((select public.tiene_modulo('pedidos')));
create policy pedidos_insert on public.pedidos
  for insert to authenticated with check ((select public.tiene_modulo('pedidos')));
create policy pedidos_update on public.pedidos
  for update to authenticated
  using ((select public.tiene_modulo('pedidos'))) with check ((select public.tiene_modulo('pedidos')));
create policy pedidos_delete on public.pedidos
  for delete to authenticated using ((select public.es_administrador()));

create policy pedido_historial_select on public.pedido_historial
  for select to authenticated using ((select public.tiene_modulo('pedidos')));
create policy pedido_avisos_select on public.pedido_avisos
  for select to authenticated using ((select public.tiene_modulo('pedidos')));

-- El estado, el origen, el teléfono de WhatsApp, la clave y "prueba" no se
-- escriben desde la API: los pone el bot (clave de servicio) o pedido_cambiar_estado
grant select, delete on public.pedidos to authenticated;
grant insert (cliente_id, tipo_entrega, direccion, entrega_en, productos, nota),
  update (cliente_id, tipo_entrega, direccion, entrega_en, productos, nota)
  on public.pedidos to authenticated;
grant select on public.pedido_historial to authenticated;
grant select on public.pedido_avisos to authenticated;

grant select on public.pedidos_resumen to authenticated;
grant select on public.oportunidades_resumen to authenticated;
grant select on public.productos_resumen to authenticated;

revoke all on function public.usuario_bot() from public, anon, authenticated;
revoke all on function public.armar_lineas(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.armar_lineas(jsonb, jsonb, boolean) to authenticated;
revoke all on function public.pedidos_preparar() from public, anon, authenticated;
revoke all on function public.pedidos_estado() from public, anon, authenticated;
revoke all on function public.pedidos_seguimiento() from public, anon, authenticated;
revoke all on function public.pedidos_proteger() from public, anon, authenticated;
revoke all on function public.oportunidades_de_pedido() from public, anon, authenticated;
revoke all on function public.pedido_cambiar_estado(bigint, text, text) from public, anon;
grant execute on function public.pedido_cambiar_estado(bigint, text, text) to authenticated;
