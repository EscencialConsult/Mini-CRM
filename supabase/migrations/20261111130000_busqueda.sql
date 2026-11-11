-- Mini-CRM · búsqueda de texto: una columna `busqueda` por vista, en minúsculas y sin tildes.
-- La app filtra con `busqueda ilike *palabra*` por cada palabra (todas deben aparecer).

create extension if not exists unaccent with schema extensions;

-- Minúsculas y sin tildes. Forma de dos argumentos: no depende del search_path.
create function public.normalizar_busqueda(texto text)
returns text
language sql stable
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')));
$$;

grant execute on function public.normalizar_busqueda(text) to authenticated;

-- Usuarios (tabla): sin tildes no es posible en una columna generada; solo minúsculas
alter table public.usuarios
  add column busqueda text generated always as (lower(nombre || ' ' || apellido || ' ' || email)) stored;

-- Las columnas nuevas se agregan al final de cada vista
create or replace view public.clientes_resumen with (security_invoker = on) as
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
  )) as busqueda
from public.clientes c
left join public.usuarios ua on ua.id = c.asignado_a
left join public.usuarios uc on uc.id = c.creado_por
left join public.usuarios um on um.id = c.actualizado_por
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

create or replace view public.oportunidades_resumen with (security_invoker = on) as
select
  o.*,
  c.nombre_completo as cliente_nombre,
  c.estado as cliente_estado,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  public.normalizar_busqueda(concat_ws(' ', o.producto_servicio, c.nombre_completo, o.descripcion)) as busqueda
from public.oportunidades o
join public.clientes c on c.id = o.cliente_id
left join public.usuarios ua on ua.id = o.asignado_a
left join public.usuarios uc on uc.id = o.creado_por
left join public.usuarios um on um.id = o.actualizado_por;

create or replace view public.actividades_resumen with (security_invoker = on) as
select
  a.*,
  c.nombre_completo as cliente_nombre,
  op.producto_servicio as oportunidad_nombre,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  (not a.completada and a.fecha < now()) as vencida,
  public.normalizar_busqueda(concat_ws(' ', a.titulo, c.nombre_completo, a.descripcion)) as busqueda
from public.actividades a
join public.clientes c on c.id = a.cliente_id
left join public.oportunidades op on op.id = a.oportunidad_id
left join public.usuarios ua on ua.id = a.asignado_a
left join public.usuarios uc on uc.id = a.creado_por
left join public.usuarios um on um.id = a.actualizado_por;

create or replace view public.auditoria_resumen with (security_invoker = on) as
select
  au.*,
  nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), '') as usuario_nombre,
  public.normalizar_busqueda(concat_ws(' ', au.descripcion, u.nombre, u.apellido)) as busqueda
from public.auditoria au
left join public.usuarios u on u.id = au.usuario_id;
