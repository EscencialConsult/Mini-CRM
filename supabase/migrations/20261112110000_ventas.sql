-- Mini-CRM · módulo Ventas: listado de ganadas y reportes.
--
-- Quien tiene el módulo ve todas las oportunidades cerradas (ganadas y
-- perdidas), aunque no tenga Tablero, con sus productos y clientes. El ranking
-- lo ven todos los que tienen el módulo. Con varios responsables, cada uno
-- suma la venta completa (el ranking suma más que el total vendido).
-- Va después de 20261112100000_motivos_de_perdida.

-- ============================================================================
-- Módulo
-- ============================================================================
alter table public.usuarios drop constraint usuarios_modulos_validos;
alter table public.usuarios add constraint usuarios_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'oportunidades', 'actividades', 'productos', 'ventas',
    'landings', 'etiquetas', 'auditoria'
  ]::text[]
);

alter table public.usuarios disable trigger user;
update public.usuarios
set modulos = '{panel,clientes,oportunidades,actividades,productos,ventas,landings,etiquetas,auditoria}'
where rol = 'administrador';
alter table public.usuarios enable trigger user;

-- ============================================================================
-- Lectura con el módulo: cerradas, sus productos y sus clientes
-- ============================================================================
drop policy oportunidades_select on public.oportunidades;
create policy oportunidades_select on public.oportunidades
  for select to authenticated
  using (
    (select public.tiene_modulo('oportunidades'))
    or (resultado <> 'abierta' and (select public.tiene_modulo('ventas')))
  );

drop policy productos_select on public.productos;
create policy productos_select on public.productos
  for select to authenticated
  using ((select public.tiene_modulo('productos', 'oportunidades', 'ventas')));

drop policy clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select to authenticated
  using ((select public.tiene_modulo('clientes', 'oportunidades', 'actividades', 'ventas')));

-- ============================================================================
-- Reportes: una consulta con todas las secciones, sobre las cerradas del
-- período [p_desde, p_hasta] (fecha de cierre, ambos inclusive; null: sin
-- límite) y los filtros elegidos. Corre con los permisos de quien consulta.
-- ============================================================================
create function public.ventas_reporte(
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
      o.fecha_cierre - (o.creado_en at time zone 'America/Argentina/Buenos_Aires')::date as ciclo
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
        'tasa_cierre', case when i.ventas + i.perdidas > 0
          then round(i.ventas::numeric / (i.ventas + i.perdidas), 4) end
      )
      from indicadores i
    ),
    'por_canal', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.importe desc, x.nombre) from por_canal x), '[]'
    ),
    'ranking', coalesce(
      (select jsonb_agg(
         to_jsonb(x) || jsonb_build_object(
           'tasa_cierre', case when x.ventas + x.perdidas > 0
             then round(x.ventas::numeric / (x.ventas + x.perdidas), 4) end
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

revoke all on function public.ventas_reporte(date, date, uuid, bigint, bigint) from public, anon;
grant execute on function public.ventas_reporte(date, date, uuid, bigint, bigint) to authenticated;
