-- Mini-CRM · motivo de pérdida de un catálogo fijo.
--
-- Una oportunidad perdida lleva su motivo (obligatorio) de una lista fija, para
-- poder reportarlo en Ventas, más un detalle libre opcional (`motivo_perdida`,
-- la columna de siempre). Va después de 20261111210000_productos_y_canales.

alter table public.oportunidades
  add column motivo_perdida_tipo text
    check (motivo_perdida_tipo in ('precio', 'competencia', 'sin_respuesta', 'otra_solucion', 'otro'));

-- ----------------------------------------------------------------------------
-- Datos existentes: el texto libre se clasifica y queda como detalle. Sin
-- triggers: no cambian autoría ni se llena la auditoría con la migración.
-- ----------------------------------------------------------------------------
alter table public.oportunidades disable trigger user;
update public.oportunidades
set motivo_perdida_tipo = case
  when motivo_perdida ~* 'precio|presupuesto|caro' then 'precio'
  when motivo_perdida ~* 'competencia' then 'competencia'
  when motivo_perdida ~* 'respond|respuesta' then 'sin_respuesta'
  when motivo_perdida ~* 'otra soluci' then 'otra_solucion'
  else 'otro'
end
where resultado = 'perdida';
alter table public.oportunidades enable trigger user;

alter table public.oportunidades
  add constraint oportunidades_motivo_perdida_check
    check (resultado <> 'perdida' or motivo_perdida_tipo is not null);

-- ----------------------------------------------------------------------------
-- Reglas: perdida exige motivo (mensaje claro antes que el CHECK); ganada o
-- abierta no lo tienen.
-- ----------------------------------------------------------------------------
create or replace function public.oportunidades_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.resultado = 'ganada' then
    new.probabilidad := 100;
    new.motivo_perdida := null;
    new.motivo_perdida_tipo := null;
    new.fecha_cierre := coalesce(new.fecha_cierre, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  elsif new.resultado = 'perdida' then
    if new.motivo_perdida_tipo is null then
      raise exception 'Elegí el motivo de la pérdida' using errcode = '23514';
    end if;
    new.probabilidad := 0;
    new.motivo_perdida := nullif(btrim(new.motivo_perdida), '');
    new.fecha_cierre := coalesce(new.fecha_cierre, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  else
    new.fecha_cierre := null;
    new.motivo_perdida := null;
    new.motivo_perdida_tipo := null;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Vista (`o.*` se expande al crearla: se recrea para sumar la columna)
-- ============================================================================
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

grant select on public.oportunidades_resumen to authenticated;
