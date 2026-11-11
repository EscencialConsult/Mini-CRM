-- Reprograma varias tareas a otro día en un solo pedido, cada una a su misma
-- hora (en la zona horaria de quien reprograma). Corre con los permisos de
-- quien la llama: RLS decide qué puede tocar. Devuelve cuántas cambió.

create function public.reprogramar_actividades(p_ids bigint[], p_dia date, p_zona text)
returns integer
language sql
set search_path = ''
as $$
  with cambiadas as (
    update public.actividades
    set fecha = (p_dia + (fecha at time zone p_zona)::time) at time zone p_zona
    where id = any (p_ids)
    returning 1
  )
  select count(*)::integer from cambiadas;
$$;

grant execute on function public.reprogramar_actividades(bigint[], date, text) to authenticated;
