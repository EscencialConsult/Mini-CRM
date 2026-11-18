-- Mini-CRM · endurecimiento de seguridad (auditoría de noviembre de 2026).
--
-- Qué hace:
--  1. Las funciones nuevas dejan de nacer ejecutables por todos, y se cierran las
--     SECURITY DEFINER que un visitante sin sesión (anon) todavía podía llamar.
--  2. Topes contra abuso en las landings públicas: visitas por conexión, y envíos
--     por landing y por cuenta (además del límite por conexión que ya tenían).
--  3. Cupo del asistente de IA por persona y por cuenta (cada consulta paga una
--     llamada al proveedor).
--  4. Cambio de clave obligatorio: quien recibe una contraseña provisoria tiene
--     que elegir una propia antes de seguir.
--
-- Va después de 20261117120000_modulo_importacion.
--
-- Importante para quien edite las landings públicas: la lógica de negocio quedó en
-- `privado.landing_recibir_base` y `privado.landing_pedido_base`; las funciones de
-- `public` solo aplican los topes y delegan. Un `create or replace` sobre
-- `public.landing_recibir` o `public.landing_pedido` pisaría los topes (la prueba
-- `supabase/tests/aislamiento_cuentas.sql` lo detecta).

-- ============================================================================
-- 1) Quién puede ejecutar qué
-- ============================================================================
-- Postgres le da EJECUTAR a PUBLIC a toda función nueva, y un
-- `alter default privileges ... in schema public revoke ... from public` (como el de
-- 20261111120200) no lo quita: solo el global. Desde acá, una función nueva solo la
-- ejecuta su dueño y service_role, hasta que se le dé un `grant` explícito.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- SECURITY DEFINER que anon podía ejecutar por quedar abiertas a PUBLIC. Ya se
-- frenaban por dentro (sin sesión no tienen módulo), pero no tienen por qué llegar.
revoke all on function public.landing_publicar(bigint) from public, anon;
revoke all on function public.landing_despublicar(bigint) from public, anon;
revoke all on function public.tiene_modulo(text[]) from public, anon;

-- Las de la app (SECURITY INVOKER) son solo para usuarios con sesión: sin permisos
-- de tabla fallarían igual, pero tampoco hace falta ofrecérselas a anon.
revoke all on function public.panel_indicadores(date, date) from public, anon;
revoke all on function public.panel_ventas_por_mes(int) from public, anon;
revoke all on function public.panel_embudo() from public, anon;
revoke all on function public.recordatorios_conteo() from public, anon;
revoke all on function public.reprogramar_actividades(bigint[], date, text) from public, anon;
revoke all on function public.cambiar_responsables_actividades(bigint[], text, uuid) from public, anon;
revoke all on function public.landing_estadisticas(bigint, int) from public, anon;
revoke all on function public.landings_indicadores(int) from public, anon;
revoke all on function public.normalizar_busqueda(text) from public, anon;

-- Función de trigger: los triggers no piden EJECUTAR a quien dispara la fila
revoke all on function public.normalizar_asignados() from public, anon, authenticated;

-- ============================================================================
-- 2) Topes contra abuso
-- ============================================================================
-- Contadores por ventana, en el esquema privado (no se expone por la API).
create table privado.limites (
  clave text primary key,
  n integer not null check (n >= 0),
  vence timestamptz not null
);
alter table privado.limites enable row level security;
revoke all on table privado.limites from public, anon, authenticated;

-- Suma una al contador de la clave y dice si todavía está dentro del máximo.
-- La ventana arranca en el primer uso y, al vencer, el contador vuelve a uno.
create function privado.limitar(p_clave text, p_ventana interval, p_maximo integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into privado.limites as l (clave, n, vence)
  values (p_clave, 1, now() + p_ventana)
  on conflict (clave) do update
    set n = case when l.vence <= now() then 1 else l.n + 1 end,
        vence = case when l.vence <= now() then now() + p_ventana else l.vence end
  returning l.n into v_n;

  -- De vez en cuando se limpian las ventanas que vencieron hace rato
  if random() < 0.02 then
    delete from privado.limites where vence < now() - interval '1 hour';
  end if;

  return v_n <= p_maximo;
end;
$$;
revoke all on function privado.limitar(text, interval, integer) from public, anon, authenticated;

-- Hash de la conexión de quien llama, con la misma sal y la misma regla que usan
-- las funciones de las landings (nunca se guarda la IP).
create function privado.ip_hash()
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(
    (select a.valor from privado.ajustes a where a.clave = 'ip_sal') || ':' || coalesce(
      nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'cf-connecting-ip', ''),
      nullif(btrim(split_part(
        coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-forwarded-for', ',', 1
      )), ''),
      'desconocida'
    ), 'UTF8')), 'hex')
$$;
revoke all on function privado.ip_hash() from public, anon, authenticated;

-- La lógica de negocio pasa a `privado`, sin tocarla; las de `public` la envuelven.
alter function public.landing_recibir(jsonb) set schema privado;
alter function privado.landing_recibir(jsonb) rename to landing_recibir_base;
alter function public.landing_pedido(jsonb) set schema privado;
alter function privado.landing_pedido(jsonb) rename to landing_pedido_base;
revoke all on function privado.landing_recibir_base(jsonb) from public, anon, authenticated;
revoke all on function privado.landing_pedido_base(jsonb) from public, anon, authenticated;

-- Formulario, WhatsApp, pedido y visitas de una landing publicada.
--  · Visitas: hasta 30 por conexión, por landing y por día. De más no se cuentan,
--    pero tampoco se le avisa a nadie (la página las manda sin esperar respuesta).
--  · Envíos: hasta 300 por hora en cada landing y 2000 por día en cada cuenta, más
--    el límite por conexión (5 cada 10 minutos) que ya aplica la función de fondo.
-- Una landing que no existe, un campo trampa o datos mal formados no gastan cupo:
-- los resuelve la función de fondo como siempre.
create function public.landing_recibir(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_datos ->> 'slug', '')));
  v_landing_id bigint;
  v_cuenta bigint;
begin
  if jsonb_typeof(p_datos) is distinct from 'object'
     or v_slug = ''
     or coalesce(p_datos ->> 'website', '') <> '' then
    return privado.landing_recibir_base(p_datos);
  end if;

  select l.id, l.cuenta_id into v_landing_id, v_cuenta
  from public.landings l
  where l.slug = v_slug and l.estado = 'publicada';
  if not found then
    return privado.landing_recibir_base(p_datos);
  end if;

  if p_datos ->> 'event' = 'visit' then
    if not privado.limitar('visita:' || v_landing_id || ':' || privado.ip_hash(), interval '1 day', 30) then
      return jsonb_build_object('ok', true);
    end if;
    return privado.landing_recibir_base(p_datos);
  end if;

  if not privado.limitar('envio:landing:' || v_landing_id, interval '1 hour', 300)
     or not privado.limitar('envio:cuenta:' || v_cuenta, interval '1 day', 2000) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return privado.landing_recibir_base(p_datos);
end;
$$;

-- Pedido del carrito de una landing: mismos topes que los envíos (comparten contador).
create function public.landing_pedido(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_datos ->> 'slug', '')));
  v_landing_id bigint;
  v_cuenta bigint;
begin
  if jsonb_typeof(p_datos) is distinct from 'object'
     or v_slug = ''
     or coalesce(p_datos ->> 'website', '') <> '' then
    return privado.landing_pedido_base(p_datos);
  end if;

  select l.id, l.cuenta_id into v_landing_id, v_cuenta
  from public.landings l
  where l.slug = v_slug and l.estado = 'publicada';
  if not found then
    return privado.landing_pedido_base(p_datos);
  end if;

  if not privado.limitar('envio:landing:' || v_landing_id, interval '1 hour', 300)
     or not privado.limitar('envio:cuenta:' || v_cuenta, interval '1 day', 2000) then
    raise exception 'Recibimos muchos pedidos en este momento: volvé a intentarlo en unos minutos'
      using errcode = 'P0001', hint = 'landing_pedido', detail = 'rate_limited';
  end if;

  return privado.landing_pedido_base(p_datos);
end;
$$;

revoke all on function public.landing_recibir(jsonb) from public;
revoke all on function public.landing_pedido(jsonb) from public;
grant execute on function public.landing_recibir(jsonb) to anon, authenticated;
grant execute on function public.landing_pedido(jsonb) to anon, authenticated;

-- ============================================================================
-- 3) Cupo del asistente de IA
-- ============================================================================
-- La llama la función de Netlify con el token de la propia persona antes de cada
-- consulta. 30 consultas cada 10 minutos por persona y 1000 por día por cuenta.
create function public.asistente_consumir()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_cuenta bigint;
begin
  if v_usuario is null then
    return false;
  end if;
  v_cuenta := public.mi_cuenta();
  if v_cuenta is null then
    return false;
  end if;
  return privado.limitar('asistente:persona:' || v_usuario, interval '10 minutes', 30)
     and privado.limitar('asistente:cuenta:' || v_cuenta, interval '1 day', 1000);
end;
$$;
revoke all on function public.asistente_consumir() from public, anon;
grant execute on function public.asistente_consumir() to authenticated;

-- ============================================================================
-- 4) Cambio de clave obligatorio
-- ============================================================================
-- La marcan las Edge Functions `users` y `cuentas` cuando le fijan una contraseña
-- a otra persona (alta o restablecimiento). Solo se limpia con `clave_cambiada()`,
-- que llama la propia persona después de elegir una clave nueva: el permiso de
-- columna del cliente sigue limitado a nombre y apellido.
alter table public.usuarios add column debe_cambiar_clave boolean not null default false;

create function public.clave_cambiada()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usuarios
     set debe_cambiar_clave = false
   where id = (select auth.uid()) and debe_cambiar_clave;
$$;
revoke all on function public.clave_cambiada() from public, anon;
grant execute on function public.clave_cambiada() to authenticated;
