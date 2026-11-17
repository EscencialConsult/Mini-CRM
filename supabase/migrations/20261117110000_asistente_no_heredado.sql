-- ============================================================================
-- El asistente no se hereda por ser administrador
-- ============================================================================
-- Hasta ahora el administrador de una cuenta tenía todo lo que incluía el plan.
-- El asistente (asistente, asistente_altas) es un extra con costo: tenerlo en el
-- plan no alcanza, hay que cederlo a cada usuario, administradores incluidos.
-- Lo demás queda igual.

create or replace function public.tiene_modulo(variadic p_modulos text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.cuentas c on c.id = u.cuenta_id
    where u.id = (select auth.uid())
      and u.activo
      and c.activa
      and exists (
        select 1
        from unnest(p_modulos) as m(modulo)
        where m.modulo = any (c.modulos)
          and (
            m.modulo = any (u.modulos)
            or (u.rol = 'administrador' and m.modulo <> all (array['asistente', 'asistente_altas']::text[]))
          )
      )
  );
$$;
