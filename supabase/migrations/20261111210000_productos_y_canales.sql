-- Mini-CRM · catálogo de productos y canales de venta.
--
-- Productos: catálogo propio (módulo Productos). Cada oportunidad lleva sus
-- líneas en `oportunidades.productos` (producto, cantidad, precio unitario y
-- descuento); la base completa nombre y subtotal, calcula el importe y arma el
-- título ("Producto A y 2 más"). Un producto en uso no se borra: se desactiva.
--
-- Canales: por dónde llega el cliente (WhatsApp, Instagram, Referido…). Los
-- administra el administrador. El cliente tiene su canal de origen y cada
-- oportunidad nueva lo toma por defecto (se puede cambiar). Quien llega por
-- una landing queda con el canal del sistema "Landing".

-- ============================================================================
-- Productos
-- ============================================================================
create table public.productos (
  id bigint generated always as identity primary key,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 80),
  descripcion text,
  precio numeric(14, 2) not null default 0 check (precio >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  actualizado_por uuid references public.usuarios (id) on delete set null
);

create unique index productos_nombre_key on public.productos (lower(nombre));

create function public.productos_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.descripcion := nullif(btrim(new.descripcion), '');
  return new;
end;
$$;

create trigger trg_10_productos_preparar
  before insert or update on public.productos
  for each row execute function public.productos_preparar();
create trigger trg_20_productos_autoria
  before insert or update on public.productos
  for each row execute function public.sellar_autoria();

-- ============================================================================
-- Canales
-- ============================================================================
create table public.canales (
  id bigint generated always as identity primary key,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 40),
  -- Canales que usa el sistema (hoy solo 'landing'): no se borran
  clave text unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index canales_nombre_key on public.canales (lower(nombre));

create function public.canales_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  if tg_op = 'UPDATE' then
    new.clave := old.clave;
    new.creado_en := old.creado_en;
  end if;
  return new;
end;
$$;

create trigger trg_10_canales_preparar
  before insert or update on public.canales
  for each row execute function public.canales_preparar();

insert into public.canales (nombre, clave) values
  ('WhatsApp', null),
  ('Instagram', null),
  ('Facebook', null),
  ('Sitio web', null),
  ('Landing', 'landing'),
  ('Referido', null),
  ('Llamada', null),
  ('Email', null),
  ('Visita / local', null),
  ('Otro', null);

-- ============================================================================
-- Columnas nuevas en clientes y oportunidades
-- ============================================================================
alter table public.clientes
  add column canal_id bigint references public.canales (id) on delete restrict;
create index clientes_canal_idx on public.clientes (canal_id) where canal_id is not null;

alter table public.oportunidades
  add column canal_id bigint references public.canales (id) on delete restrict,
  add column productos jsonb not null default '[]'
    check (jsonb_typeof(productos) = 'array');
create index oportunidades_canal_idx on public.oportunidades (canal_id) where canal_id is not null;
create index oportunidades_productos_idx on public.oportunidades using gin (productos jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- Datos existentes: cada texto distinto pasa a ser un producto (precio de lista:
-- el promedio redondeado a miles) y cada oportunidad, una línea con su mismo
-- importe. Los clientes de landings quedan con el canal "Landing" y cada
-- oportunidad con el canal de su cliente. Sin triggers: no cambian autoría ni
-- se llena la auditoría con la migración.
-- ----------------------------------------------------------------------------
insert into public.productos (nombre, precio)
select min(btrim(producto_servicio)), round(avg(importe_estimado), -3)
from public.oportunidades
group by lower(btrim(producto_servicio));

alter table public.clientes disable trigger user;
alter table public.oportunidades disable trigger user;

update public.clientes
set canal_id = (select id from public.canales where clave = 'landing')
where landing_id is not null;

update public.oportunidades o
set productos = jsonb_build_array(jsonb_build_object(
      'producto_id', p.id,
      'nombre', p.nombre,
      'cantidad', 1,
      'precio_unitario', o.importe_estimado,
      'descuento', 0,
      'subtotal', o.importe_estimado
    )),
    canal_id = c.canal_id
from public.productos p, public.clientes c
where lower(p.nombre) = lower(btrim(o.producto_servicio))
  and c.id = o.cliente_id;

alter table public.clientes enable trigger user;
alter table public.oportunidades enable trigger user;

-- ============================================================================
-- Reglas
-- ============================================================================

-- Líneas de la oportunidad: valida, completa nombre y subtotal, y de ahí salen
-- el importe y el título. Un producto inactivo solo puede quedar si ya estaba.
create function public.oportunidades_productos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_producto public.productos;
  v_lineas jsonb := '[]';
  v_nombres text[] := '{}';
  v_cantidad numeric;
  v_precio numeric;
  v_descuento numeric;
  v_subtotal numeric;
  v_total numeric := 0;
begin
  if tg_op = 'UPDATE' and new.productos is not distinct from old.productos then
    return new;
  end if;
  if jsonb_array_length(new.productos) = 0 then
    raise exception 'Agregá al menos un producto' using errcode = '23514';
  end if;

  for v_linea in select value from jsonb_array_elements(new.productos) loop
    select * into v_producto
    from public.productos
    where id = (v_linea ->> 'producto_id')::bigint;
    if not found then
      raise exception 'Uno de los productos ya no existe' using errcode = '23503';
    end if;
    if not v_producto.activo and not (
      tg_op = 'UPDATE'
      and old.productos @> jsonb_build_array(jsonb_build_object('producto_id', v_producto.id))
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
    v_total := v_total + v_subtotal;
    v_nombres := v_nombres || v_producto.nombre;
    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_producto.id,
      'nombre', v_producto.nombre,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'descuento', v_descuento,
      'subtotal', v_subtotal
    );
  end loop;

  new.productos := v_lineas;
  new.importe_estimado := v_total;
  new.producto_servicio := case cardinality(v_nombres)
    when 1 then v_nombres[1]
    when 2 then v_nombres[1] || ' y ' || v_nombres[2]
    else v_nombres[1] || ' y ' || (cardinality(v_nombres) - 1) || ' más'
  end;
  return new;
end;
$$;

create trigger trg_18_oportunidades_productos
  before insert or update on public.oportunidades
  for each row execute function public.oportunidades_productos();

-- Oportunidad nueva sin canal: el del cliente
create function public.oportunidades_canal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.canal_id is null then
    new.canal_id := (select c.canal_id from public.clientes c where c.id = new.cliente_id);
  end if;
  return new;
end;
$$;

create trigger trg_12_oportunidades_canal
  before insert on public.oportunidades
  for each row execute function public.oportunidades_canal();

-- Cliente nuevo que llega por una landing: canal "Landing"
create function public.clientes_canal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.canal_id is null and new.landing_id is not null then
    new.canal_id := (select id from public.canales where clave = 'landing');
  end if;
  return new;
end;
$$;

create trigger trg_05_clientes_canal
  before insert on public.clientes
  for each row execute function public.clientes_canal();

-- No se borra lo que está en uso (mensaje claro en vez del error de clave
-- foránea). SECURITY DEFINER: tiene que ver todo, no solo lo que RLS le muestra
create function public.productos_proteger()
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
  return old;
end;
$$;

create trigger trg_10_productos_proteger
  before delete on public.productos
  for each row execute function public.productos_proteger();

create function public.canales_proteger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.clave is not null then
    raise exception 'El canal «%» lo usa el sistema: no se puede borrar', old.nombre
      using errcode = '42501';
  end if;
  if exists (select 1 from public.clientes where canal_id = old.id)
     or exists (select 1 from public.oportunidades where canal_id = old.id) then
    raise exception 'El canal está en uso: desactivalo en vez de borrarlo'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger trg_10_canales_proteger
  before delete on public.canales
  for each row execute function public.canales_proteger();

-- ============================================================================
-- Módulo Productos
-- ============================================================================
alter table public.usuarios drop constraint usuarios_modulos_validos;
alter table public.usuarios add constraint usuarios_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'oportunidades', 'actividades', 'productos',
    'landings', 'etiquetas', 'auditoria'
  ]::text[]
);

alter table public.usuarios disable trigger user;
update public.usuarios
set modulos = '{panel,clientes,oportunidades,actividades,productos,landings,etiquetas,auditoria}'
where rol = 'administrador';
alter table public.usuarios enable trigger user;

-- ============================================================================
-- Vistas (`o.*` / `c.*` se expanden al crearlas: se recrean para sumar columnas)
-- ============================================================================
create view public.productos_resumen with (security_invoker = on) as
select
  p.*,
  (
    select count(*) from public.oportunidades o
    where o.productos @> jsonb_build_array(jsonb_build_object('producto_id', p.id))
  )::int as oportunidades,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  public.normalizar_busqueda(concat_ws(' ', p.nombre, p.descripcion)) as busqueda
from public.productos p
left join public.usuarios uc on uc.id = p.creado_por
left join public.usuarios um on um.id = p.actualizado_por;

create view public.canales_resumen with (security_invoker = on) as
select
  ca.*,
  (select count(*) from public.clientes c where c.canal_id = ca.id)::int as clientes,
  (select count(*) from public.oportunidades o where o.canal_id = ca.id)::int as oportunidades
from public.canales ca;

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
  l.nombre as landing_nombre,
  ca.nombre as canal_nombre
from public.clientes c
left join public.usuarios ua on ua.id = c.asignado_a
left join public.usuarios uc on uc.id = c.creado_por
left join public.usuarios um on um.id = c.actualizado_por
left join public.landings l on l.id = c.landing_id
left join public.canales ca on ca.id = c.canal_id
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
alter table public.productos enable row level security;
alter table public.canales enable row level security;

-- Productos: los eligen quienes cargan oportunidades; el catálogo es del módulo
create policy productos_select on public.productos
  for select to authenticated
  using ((select public.tiene_modulo('productos', 'oportunidades')));
create policy productos_insert on public.productos
  for insert to authenticated with check ((select public.tiene_modulo('productos')));
create policy productos_update on public.productos
  for update to authenticated
  using ((select public.tiene_modulo('productos'))) with check ((select public.tiene_modulo('productos')));
create policy productos_delete on public.productos
  for delete to authenticated using ((select public.tiene_modulo('productos')));

-- Canales: los ve cualquiera; los administra el administrador
create policy canales_select on public.canales
  for select to authenticated using ((select public.usuario_activo()));
create policy canales_insert on public.canales
  for insert to authenticated with check ((select public.es_administrador()));
create policy canales_update on public.canales
  for update to authenticated
  using ((select public.es_administrador())) with check ((select public.es_administrador()));
create policy canales_delete on public.canales
  for delete to authenticated using ((select public.es_administrador()));

grant select, delete on public.productos to authenticated;
grant insert (nombre, descripcion, precio, activo), update (nombre, descripcion, precio, activo)
  on public.productos to authenticated;
grant select, delete on public.canales to authenticated;
grant insert (nombre, activo), update (nombre, activo) on public.canales to authenticated;

grant select on public.productos_resumen to authenticated;
grant select on public.canales_resumen to authenticated;
grant select on public.oportunidades_resumen to authenticated;
grant select on public.clientes_resumen to authenticated;

revoke all on function public.productos_preparar() from public, anon, authenticated;
revoke all on function public.canales_preparar() from public, anon, authenticated;
revoke all on function public.oportunidades_productos() from public, anon, authenticated;
revoke all on function public.oportunidades_canal() from public, anon, authenticated;
revoke all on function public.clientes_canal() from public, anon, authenticated;
revoke all on function public.productos_proteger() from public, anon, authenticated;
revoke all on function public.canales_proteger() from public, anon, authenticated;
