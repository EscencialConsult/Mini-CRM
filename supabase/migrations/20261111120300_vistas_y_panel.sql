-- Mini-CRM · vistas de lectura (con nombres ya resueltos) y funciones agregadas del panel.
-- Las vistas son SECURITY INVOKER: aplican las políticas RLS del usuario que consulta.
-- Escritura siempre sobre las tablas base.

create view public.clientes_resumen with (security_invoker = on) as
select
  c.*,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  coalesce(o.abiertas, 0)::int as oportunidades_abiertas,
  coalesce(o.importe_abierto, 0) as importe_abierto,
  coalesce(a.pendientes, 0)::int as actividades_pendientes,
  a.ultima_actividad
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

create view public.oportunidades_resumen with (security_invoker = on) as
select
  o.*,
  c.nombre_completo as cliente_nombre,
  c.estado as cliente_estado,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre
from public.oportunidades o
join public.clientes c on c.id = o.cliente_id
left join public.usuarios ua on ua.id = o.asignado_a
left join public.usuarios uc on uc.id = o.creado_por
left join public.usuarios um on um.id = o.actualizado_por;

create view public.actividades_resumen with (security_invoker = on) as
select
  a.*,
  c.nombre_completo as cliente_nombre,
  op.producto_servicio as oportunidad_nombre,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  (not a.completada and a.fecha < now()) as vencida
from public.actividades a
join public.clientes c on c.id = a.cliente_id
left join public.oportunidades op on op.id = a.oportunidad_id
left join public.usuarios ua on ua.id = a.asignado_a
left join public.usuarios uc on uc.id = a.creado_por
left join public.usuarios um on um.id = a.actualizado_por;

create view public.auditoria_resumen with (security_invoker = on) as
select
  au.*,
  nullif(btrim(concat_ws(' ', u.nombre, u.apellido)), '') as usuario_nombre
from public.auditoria au
left join public.usuarios u on u.id = au.usuario_id;

-- ============================================================================
-- Panel de control: funciones agregadas (una consulta por sección)
-- ============================================================================

-- Indicadores del período [p_desde, p_hasta] (ambos inclusive, hora de Argentina)
create function public.panel_indicadores(p_desde date, p_hasta date)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'clientes_total', (select count(*) from public.clientes),
    'clientes_activos', (select count(*) from public.clientes where estado = 'activo'),
    'clientes_nuevos', (
      select count(*) from public.clientes
      where (creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    ),
    'oportunidades_abiertas', (select count(*) from public.oportunidades where resultado = 'abierta'),
    'importe_abierto', (
      select coalesce(sum(importe_estimado), 0) from public.oportunidades where resultado = 'abierta'
    ),
    'importe_ponderado', (
      select coalesce(sum(importe_estimado * probabilidad / 100.0), 0)
      from public.oportunidades where resultado = 'abierta'
    ),
    'ganadas_cantidad', (
      select count(*) from public.oportunidades
      where resultado = 'ganada' and fecha_cierre between p_desde and p_hasta
    ),
    'ganadas_importe', (
      select coalesce(sum(importe_estimado), 0) from public.oportunidades
      where resultado = 'ganada' and fecha_cierre between p_desde and p_hasta
    ),
    'perdidas_cantidad', (
      select count(*) from public.oportunidades
      where resultado = 'perdida' and fecha_cierre between p_desde and p_hasta
    ),
    'perdidas_importe', (
      select coalesce(sum(importe_estimado), 0) from public.oportunidades
      where resultado = 'perdida' and fecha_cierre between p_desde and p_hasta
    ),
    'actividades_pendientes', (select count(*) from public.actividades where not completada),
    'actividades_vencidas', (
      select count(*) from public.actividades where not completada and fecha < now()
    )
  );
$$;

-- Ventas ganadas y perdidas de los últimos p_meses meses (incluye el actual)
create function public.panel_ventas_por_mes(p_meses int default 6)
returns table (
  mes date,
  ganadas_cantidad int,
  ganadas_importe numeric,
  perdidas_cantidad int,
  perdidas_importe numeric
)
language sql stable
set search_path = ''
as $$
  with meses as (
    select generate_series(
      date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date
        - ((greatest(least(p_meses, 24), 1) - 1) * interval '1 month'),
      date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires')::date)::date,
      interval '1 month'
    )::date as mes
  )
  select
    m.mes,
    (count(o.id) filter (where o.resultado = 'ganada'))::int,
    coalesce(sum(o.importe_estimado) filter (where o.resultado = 'ganada'), 0),
    (count(o.id) filter (where o.resultado = 'perdida'))::int,
    coalesce(sum(o.importe_estimado) filter (where o.resultado = 'perdida'), 0)
  from meses m
  left join public.oportunidades o
    on o.resultado in ('ganada', 'perdida')
   and date_trunc('month', o.fecha_cierre)::date = m.mes
  group by m.mes
  order by m.mes;
$$;

-- Embudo: oportunidades abiertas por etapa
create function public.panel_embudo()
returns table (etapa text, cantidad int, importe numeric)
language sql stable
set search_path = ''
as $$
  select
    e.etapa,
    (count(o.id))::int,
    coalesce(sum(o.importe_estimado), 0)
  from (values ('prospecto', 1), ('calificado', 2), ('propuesta', 3), ('negociacion', 4)) as e (etapa, orden)
  left join public.oportunidades o on o.etapa = e.etapa and o.resultado = 'abierta'
  group by e.etapa, e.orden
  order by e.orden;
$$;

-- Recordatorios del usuario que consulta: vencidos y de hoy
create function public.recordatorios_conteo()
returns jsonb
language sql stable
set search_path = ''
as $$
  with hoy as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d)
  select jsonb_build_object(
    'actividades_vencidas', (
      select count(*) from public.actividades a, hoy
      where not a.completada and a.asignado_a = (select auth.uid())
        and (a.fecha at time zone 'America/Argentina/Buenos_Aires')::date < hoy.d
    ),
    'actividades_hoy', (
      select count(*) from public.actividades a, hoy
      where not a.completada and a.asignado_a = (select auth.uid())
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

-- ============================================================================
-- Permisos
-- ============================================================================
grant select on public.clientes_resumen to authenticated;
grant select on public.oportunidades_resumen to authenticated;
grant select on public.actividades_resumen to authenticated;
grant select on public.auditoria_resumen to authenticated;

grant execute on function public.panel_indicadores(date, date) to authenticated;
grant execute on function public.panel_ventas_por_mes(int) to authenticated;
grant execute on function public.panel_embudo() to authenticated;
grant execute on function public.recordatorios_conteo() to authenticated;
