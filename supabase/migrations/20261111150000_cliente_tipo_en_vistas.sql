-- Tareas y oportunidades traen el tipo del cliente (persona o empresa), para el
-- filtro "Solo empresas". La columna va al final: create or replace view no
-- deja cambiar el orden de las existentes.

create or replace view public.oportunidades_resumen with (security_invoker = on) as
select
  o.*,
  c.nombre_completo as cliente_nombre,
  c.estado as cliente_estado,
  nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), '') as asignado_nombre,
  nullif(btrim(concat_ws(' ', uc.nombre, uc.apellido)), '') as creado_por_nombre,
  nullif(btrim(concat_ws(' ', um.nombre, um.apellido)), '') as actualizado_por_nombre,
  public.normalizar_busqueda(concat_ws(' ', o.producto_servicio, c.nombre_completo, o.descripcion)) as busqueda,
  c.tipo as cliente_tipo
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
  public.normalizar_busqueda(concat_ws(' ', a.titulo, c.nombre_completo, a.descripcion)) as busqueda,
  c.tipo as cliente_tipo
from public.actividades a
join public.clientes c on c.id = a.cliente_id
left join public.oportunidades op on op.id = a.oportunidad_id
left join public.usuarios ua on ua.id = a.asignado_a
left join public.usuarios uc on uc.id = a.creado_por
left join public.usuarios um on um.id = a.actualizado_por;
