-- Mini-CRM · prueba gratis de tres días: la cuenta se corta sola al vencer.
--
-- Qué hace:
--  1. `cuentas.prueba_hasta`: hasta cuándo dura la prueba. Null = cuenta sin prueba
--     (paga, o la de la plataforma). Pasada esa fecha la cuenta queda bloqueada igual
--     que una suspendida: sus usuarios no ven ni cambian datos y sus landings públicas
--     dejan de atender. No hay tarea programada: cada chequeo compara contra now(), así
--     que el corte es inmediato.
--  2. Las cuatro funciones que deciden si una cuenta se puede usar (`usuario_activo`,
--     `es_administrador`, `tiene_modulo`, `cuenta_habilitada`) pasan a usar
--     `privado.cuenta_vigente`: activa Y sin vencer.
--  3. `cuenta_alta` acepta los días de prueba (opcional): la cuenta nace con su
--     vencimiento en la misma transacción.
--
-- Las cuentas que ya existen quedan SIN prueba (prueba_hasta null): nada se corta al
-- aplicar esta migración. La plataforma pone en prueba, extiende, corta o pasa a paga
-- cada cuenta desde la función `cuentas`.
-- Va después de 20261118100000_endurecer_seguridad.

alter table public.cuentas add column prueba_hasta timestamptz;

-- ============================================================================
-- ¿La cuenta se puede usar? Activa y, si es de prueba, sin vencer
-- ============================================================================
-- Un solo lugar para la regla: cualquier chequeo nuevo de «cuenta usable» llama a esta.
create function privado.cuenta_vigente(p_activa boolean, p_prueba_hasta timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_activa and (p_prueba_hasta is null or p_prueba_hasta > now())
$$;
revoke all on function privado.cuenta_vigente(boolean, timestamptz) from public, anon, authenticated;

-- ¿La cuenta está vigente y tiene este módulo? Para las funciones públicas de las
-- landings (sin sesión). Una prueba vencida deja de atender sus landings.
create or replace function public.cuenta_habilitada(p_cuenta bigint, p_modulo text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cuentas c
    where c.id = p_cuenta
      and privado.cuenta_vigente(c.activa, c.prueba_hasta)
      and p_modulo = any (c.modulos)
  );
$$;

create or replace function public.usuario_activo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.cuentas c on c.id = u.cuenta_id
    where u.id = (select auth.uid()) and u.activo and privado.cuenta_vigente(c.activa, c.prueba_hasta)
  );
$$;

create or replace function public.es_administrador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.cuentas c on c.id = u.cuenta_id
    where u.id = (select auth.uid()) and u.activo and privado.cuenta_vigente(c.activa, c.prueba_hasta)
      and u.rol = 'administrador'
  );
$$;

-- Un módulo se usa si la cuenta (vigente) lo tiene Y el usuario lo tiene. El asistente
-- no se hereda por ser administrador (20261117110000).
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
      and privado.cuenta_vigente(c.activa, c.prueba_hasta)
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

-- ============================================================================
-- Alta de una cuenta, ahora con prueba opcional
-- ============================================================================
-- Misma transacción que antes (cuenta + canales + perfil del titular); si se piden días
-- de prueba, la cuenta nace con su vencimiento. Quien llamaba con 7 argumentos sigue
-- funcionando: el octavo es opcional.
drop function public.cuenta_alta(text, text[], integer, uuid, text, text, text);
create function public.cuenta_alta(
  p_nombre text,
  p_modulos text[],
  p_max_usuarios integer,
  p_usuario uuid,
  p_email text,
  p_nombre_titular text,
  p_apellido_titular text,
  p_prueba_dias integer default null
)
returns public.cuentas
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
begin
  if p_prueba_dias is not null and p_prueba_dias not between 1 and 60 then
    raise exception 'Los días de prueba deben ser de 1 a 60' using errcode = '22023';
  end if;

  insert into public.cuentas (nombre, modulos, max_usuarios, prueba_hasta)
  values (
    p_nombre, p_modulos, p_max_usuarios,
    case when p_prueba_dias is not null then now() + make_interval(days => p_prueba_dias) end
  )
  returning * into v_cuenta;

  perform public.cuenta_sembrar(v_cuenta.id);

  insert into public.usuarios (id, cuenta_id, email, nombre, apellido, rol, activo, modulos)
  values (p_usuario, v_cuenta.id, p_email, p_nombre_titular, p_apellido_titular, 'administrador', true, p_modulos);

  return v_cuenta;
end;
$$;
revoke all on function public.cuenta_alta(text, text[], integer, uuid, text, text, text, integer) from public, anon, authenticated;
