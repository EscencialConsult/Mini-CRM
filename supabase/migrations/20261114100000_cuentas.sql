-- Mini-CRM · Cuentas: varias empresas en la misma instalación, cada una con sus
-- propios usuarios y datos, aisladas entre sí.
--
-- Qué hay:
--  · `cuentas`: una por cliente que contrata el sistema. Tiene los módulos que
--    compró (`modulos`, el techo de lo que sus usuarios pueden usar), un máximo
--    de usuarios activos (`max_usuarios`, null = sin límite) y un interruptor
--    (`activa`) para suspenderla: sus usuarios dejan de ver y escribir datos.
--  · Cada usuario pertenece a una cuenta (`usuarios.cuenta_id`). El
--    administrador de una cuenta gestiona SOLO a los usuarios de su cuenta.
--  · `usuarios.plataforma`: el dueño del sistema. Crea y administra cuentas
--    desde la pantalla «Cuentas». No ve los datos de negocio de las demás.
--
-- Cómo se aísla (sin reescribir las reglas que ya funcionan):
--  · Todas las tablas de negocio suman `cuenta_id` y una política RESTRICTIVE
--    (`aislar_cuenta`): se combina con AND con las políticas de siempre, así
--    cada usuario solo ve y escribe filas de su cuenta.
--  · `cuenta_id` lo completa un trigger (`trg_00_cuenta_sellar`) y nunca lo
--    manda el cliente: sale de la fila padre (el cliente de una oportunidad, la
--    landing de un envío) o, si no tiene, de la cuenta de quien escribe. Si una
--    referencia apunta a otra cuenta, la fila se rechaza.
--  · Las funciones SECURITY DEFINER (landings públicas, pedidos) no pasan por
--    RLS: acá se reescriben para filtrar por la cuenta de la landing o del
--    pedido.
--
-- Compatibilidad: todo lo que existe hoy queda en la «Cuenta principal» con
-- todos los módulos y sin límite; con una sola cuenta el sistema se comporta
-- exactamente igual. Quien escribe sin sesión (clave de servicio: el bot de
-- WhatsApp, scripts/crear-admin.mjs) escribe en la cuenta principal.
-- Va después de 20261113130000_landing_pedido_idempotente.

-- ============================================================================
-- Cuentas
-- ============================================================================
create table public.cuentas (
  id bigint generated always as identity primary key,
  nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 80),
  activa boolean not null default true,
  -- null = sin límite
  max_usuarios integer check (max_usuarios is null or max_usuarios >= 1),
  -- Techo de módulos de la cuenta. Mismo conjunto que usuarios_modulos_validos
  modulos text[] not null
    default '{panel,clientes,oportunidades,pedidos,actividades,productos,ventas,landings,etiquetas,auditoria}',
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint cuentas_modulos_validos check (
    modulos <@ array[
      'panel', 'clientes', 'oportunidades', 'pedidos', 'actividades',
      'productos', 'ventas', 'landings', 'etiquetas', 'auditoria'
    ]::text[]
  )
);

create unique index cuentas_nombre_key on public.cuentas (lower(nombre));

-- Todo lo que existe hoy pasa a esta cuenta
insert into public.cuentas (nombre) values ('Cuenta principal');

-- ============================================================================
-- Columna cuenta_id en usuarios y en las tablas de negocio
-- ============================================================================
-- `default 1` solo para las filas que ya existen (no reescribe la tabla ni
-- dispara triggers); enseguida se quita: de acá en más lo completa el trigger.
alter table public.usuarios
  add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict,
  add column plataforma boolean not null default false;
alter table public.usuarios alter column cuenta_id drop default;

alter table public.clientes          add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.oportunidades     add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.actividades       add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.auditoria         add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.landings          add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.landing_envios    add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.landing_visitas   add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.etiquetas         add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.productos         add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.canales           add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.pedidos           add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.pedido_historial  add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;
alter table public.pedido_avisos     add column cuenta_id bigint not null default 1 references public.cuentas (id) on delete restrict;

alter table public.clientes          alter column cuenta_id drop default;
alter table public.oportunidades     alter column cuenta_id drop default;
alter table public.actividades       alter column cuenta_id drop default;
alter table public.auditoria         alter column cuenta_id drop default;
alter table public.landings          alter column cuenta_id drop default;
alter table public.landing_envios    alter column cuenta_id drop default;
alter table public.landing_visitas   alter column cuenta_id drop default;
alter table public.etiquetas         alter column cuenta_id drop default;
alter table public.productos         alter column cuenta_id drop default;
alter table public.canales           alter column cuenta_id drop default;
alter table public.pedidos           alter column cuenta_id drop default;
alter table public.pedido_historial  alter column cuenta_id drop default;
alter table public.pedido_avisos     alter column cuenta_id drop default;

create index usuarios_cuenta_idx          on public.usuarios (cuenta_id);
create index clientes_cuenta_idx          on public.clientes (cuenta_id);
create index oportunidades_cuenta_idx     on public.oportunidades (cuenta_id);
create index actividades_cuenta_idx       on public.actividades (cuenta_id);
create index auditoria_cuenta_idx         on public.auditoria (cuenta_id, fecha desc);
create index landings_cuenta_idx          on public.landings (cuenta_id);
create index landing_envios_cuenta_idx    on public.landing_envios (cuenta_id);
create index landing_visitas_cuenta_idx   on public.landing_visitas (cuenta_id);
create index etiquetas_cuenta_idx         on public.etiquetas (cuenta_id);
create index productos_cuenta_idx         on public.productos (cuenta_id);
create index canales_cuenta_idx           on public.canales (cuenta_id);
create index pedidos_cuenta_idx           on public.pedidos (cuenta_id);
create index pedido_historial_cuenta_idx  on public.pedido_historial (cuenta_id);
create index pedido_avisos_cuenta_idx     on public.pedido_avisos (cuenta_id);

-- ----------------------------------------------------------------------------
-- Lo que era único en todo el sistema pasa a ser único por cuenta. Los nombres
-- de los índices no cambian: el cliente los usa para mostrar el error.
-- ----------------------------------------------------------------------------
drop index public.clientes_documento_key;
create unique index clientes_documento_key on public.clientes (cuenta_id, documento) where documento is not null;
drop index public.etiquetas_nombre_key;
create unique index etiquetas_nombre_key on public.etiquetas (cuenta_id, lower(nombre));
drop index public.productos_nombre_key;
create unique index productos_nombre_key on public.productos (cuenta_id, lower(nombre));
drop index public.canales_nombre_key;
create unique index canales_nombre_key on public.canales (cuenta_id, lower(nombre));
alter table public.canales drop constraint canales_clave_key;
create unique index canales_clave_key on public.canales (cuenta_id, clave) where clave is not null;
-- landings_slug_key sigue global: el slug es la dirección pública de la página

-- Registro de plataforma y de cuentas en la auditoría
alter table public.auditoria drop constraint auditoria_entidad_check;
alter table public.auditoria add constraint auditoria_entidad_check
  check (entidad in ('clientes', 'oportunidades', 'actividades', 'usuarios', 'landings', 'pedidos', 'cuentas'));

-- ============================================================================
-- Helpers
-- ============================================================================
-- Cuenta del usuario con sesión. SECURITY DEFINER por lo mismo que
-- usuario_activo(): no recursar en las políticas de `usuarios`.
create function public.mi_cuenta()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select u.cuenta_id from public.usuarios u where u.id = (select auth.uid());
$$;

create function public.es_plataforma()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.activo and u.plataforma
  );
$$;

-- La cuenta principal: la primera, donde quedó todo lo que existía antes de las
-- cuentas. SECURITY DEFINER: dentro de una política, `cuentas` solo mostraría la
-- propia de quien consulta y todos se creerían la principal.
create function public.cuenta_principal()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select min(c.id) from public.cuentas c;
$$;

-- Cuenta donde escribe quien llama: la suya si tiene sesión; sin sesión (clave de
-- servicio, scripts), la cuenta principal. Una sesión sin perfil no escribe en ninguna.
create function public.cuenta_actual()
returns bigint
language sql stable security definer set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null then public.mi_cuenta()
    else public.cuenta_principal()
  end;
$$;

-- ¿La cuenta está activa y tiene este módulo? Para las funciones públicas de las
-- landings, que no tienen sesión (corren como SECURITY DEFINER).
create function public.cuenta_habilitada(p_cuenta bigint, p_modulo text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cuentas c
    where c.id = p_cuenta and c.activa and p_modulo = any (c.modulos)
  );
$$;
revoke all on function public.cuenta_habilitada(bigint, text) from public, anon, authenticated;

-- Los helpers de sesión son solo para usuarios con sesión
revoke all on function public.mi_cuenta() from public, anon;
revoke all on function public.cuenta_principal() from public, anon;
revoke all on function public.es_plataforma() from public, anon;
revoke all on function public.cuenta_actual() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;
grant execute on function public.cuenta_principal() to authenticated;
grant execute on function public.es_plataforma() to authenticated;
grant execute on function public.cuenta_actual() to authenticated;

-- Una cuenta suspendida deja sin acceso a todos sus usuarios: los tres helpers
-- que usan las políticas la tienen en cuenta.
create or replace function public.usuario_activo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.cuentas c on c.id = u.cuenta_id
    where u.id = (select auth.uid()) and u.activo and c.activa
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
    where u.id = (select auth.uid()) and u.activo and c.activa and u.rol = 'administrador'
  );
$$;

-- Un módulo se usa si la cuenta lo compró Y el usuario lo tiene (el
-- administrador de la cuenta tiene todos los de su cuenta).
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
          and (u.rol = 'administrador' or m.modulo = any (u.modulos))
      )
  );
$$;

-- ============================================================================
-- Completar y verificar cuenta_id (BEFORE INSERT OR UPDATE, primero de todos)
-- ============================================================================
-- Argumentos: pares «columna:tabla» de las referencias que tiene la fila (la
-- fila hereda la cuenta de su padre). SECURITY DEFINER: tiene que ver el padre
-- aunque RLS no se lo muestre, para poder rechazar una referencia ajena.
create function public.cuenta_sellar()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_par text;
  v_valor text;
  v_cuenta bigint;
  v_derivada bigint;
  -- La cuenta de quien escribe; null sin sesión (clave de servicio, scripts)
  v_mia bigint := public.mi_cuenta();
begin
  if tg_op = 'UPDATE' and new.cuenta_id is distinct from old.cuenta_id then
    raise exception 'Un registro no se puede pasar a otra cuenta' using errcode = '42501';
  end if;

  -- Un usuario nuevo no se manda a la principal «por omisión» cuando hay varias
  -- cuentas: una función vieja o un script dejarían a un administrador donde no
  -- corresponde. Con una sola cuenta sigue valiendo el respaldo.
  if tg_table_name = 'usuarios' and tg_op = 'INSERT' and new.cuenta_id is null
     and v_mia is null and (select count(*) from public.cuentas) > 1 then
    raise exception 'Indicá la cuenta del usuario (cuenta_id)' using errcode = '23502';
  end if;

  foreach v_par in array coalesce(tg_argv, '{}'::text[]) loop
    v_valor := to_jsonb(new) ->> split_part(v_par, ':', 1);
    continue when v_valor is null;
    -- Los ids son bigint, salvo los de usuarios (uuid)
    if split_part(v_par, ':', 2) = 'usuarios' then
      execute 'select cuenta_id from public.usuarios where id = $1' into v_cuenta using v_valor::uuid;
    else
      execute format('select cuenta_id from public.%I where id = $1', split_part(v_par, ':', 2))
        into v_cuenta using v_valor::bigint;
    end if;
    -- Inexistente y de otra cuenta dan el MISMO error: así no se puede averiguar
    -- qué ids existen en las demás cuentas
    if v_cuenta is null or v_cuenta is distinct from coalesce(v_mia, v_derivada, v_cuenta) then
      raise exception 'La referencia no existe o no es de esta cuenta' using errcode = '23503';
    end if;
    v_derivada := v_cuenta;
  end loop;

  if new.cuenta_id is null then
    new.cuenta_id := coalesce(v_derivada, public.cuenta_actual());
  elsif v_derivada is not null and v_derivada <> new.cuenta_id then
    raise exception 'La referencia no existe o no es de esta cuenta' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- La auditoría hereda la cuenta del cliente; si ya no existe (se acaba de
-- borrar), la de quien actuó
create function public.cuenta_sellar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.cuenta_id is null then
    new.cuenta_id := coalesce(
      (select c.cuenta_id from public.clientes c where c.id = new.cliente_id),
      (select u.cuenta_id from public.usuarios u where u.id = new.usuario_id),
      public.cuenta_actual()
    );
  end if;
  return new;
end;
$$;

-- Los productos de las líneas (oportunidades y pedidos) tienen que ser de la
-- misma cuenta. Corre antes que armar_lineas, que los lee sin pasar por RLS
-- cuando la escritura viene de una función SECURITY DEFINER.
create function public.cuenta_verificar_productos()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(new.productos) as l(valor)
    join public.productos p
      on p.id::numeric = case
           when jsonb_typeof(l.valor -> 'producto_id') = 'number' then (l.valor ->> 'producto_id')::numeric
         end
    where p.cuenta_id <> new.cuenta_id
  ) then
    raise exception 'Hay un producto que no es de esta cuenta' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_00_cuenta_sellar before insert or update on public.usuarios
  for each row execute function public.cuenta_sellar();
create trigger trg_00_cuenta_sellar before insert or update on public.clientes
  for each row execute function public.cuenta_sellar('landing_id:landings', 'canal_id:canales', 'asignado_a:usuarios');
create trigger trg_00_cuenta_sellar before insert or update on public.oportunidades
  for each row execute function public.cuenta_sellar('cliente_id:clientes', 'canal_id:canales', 'pedido_id:pedidos');
create trigger trg_00_cuenta_sellar before insert or update on public.actividades
  for each row execute function public.cuenta_sellar('cliente_id:clientes', 'oportunidad_id:oportunidades');
create trigger trg_00_cuenta_sellar before insert or update on public.landings
  for each row execute function public.cuenta_sellar();
create trigger trg_00_cuenta_sellar before insert or update on public.landing_envios
  for each row execute function public.cuenta_sellar('landing_id:landings', 'cliente_id:clientes');
create trigger trg_00_cuenta_sellar before insert or update on public.landing_visitas
  for each row execute function public.cuenta_sellar('landing_id:landings');
create trigger trg_00_cuenta_sellar before insert or update on public.etiquetas
  for each row execute function public.cuenta_sellar();
create trigger trg_00_cuenta_sellar before insert or update on public.productos
  for each row execute function public.cuenta_sellar();
create trigger trg_00_cuenta_sellar before insert or update on public.canales
  for each row execute function public.cuenta_sellar();
create trigger trg_00_cuenta_sellar before insert or update on public.pedidos
  for each row execute function public.cuenta_sellar('cliente_id:clientes');
create trigger trg_00_cuenta_sellar before insert or update on public.pedido_historial
  for each row execute function public.cuenta_sellar('pedido_id:pedidos');
create trigger trg_00_cuenta_sellar before insert or update on public.pedido_avisos
  for each row execute function public.cuenta_sellar('pedido_id:pedidos');
create trigger trg_00_cuenta_sellar before insert or update on public.auditoria
  for each row execute function public.cuenta_sellar_auditoria();

create trigger trg_01_cuenta_productos before insert or update on public.oportunidades
  for each row execute function public.cuenta_verificar_productos();
create trigger trg_01_cuenta_productos before insert or update on public.pedidos
  for each row execute function public.cuenta_verificar_productos();

-- Los helpers de trigger no son para la API
revoke all on function public.cuenta_sellar() from public, anon, authenticated;
revoke all on function public.cuenta_sellar_auditoria() from public, anon, authenticated;
revoke all on function public.cuenta_verificar_productos() from public, anon, authenticated;

-- ============================================================================
-- Seguridad: aislamiento por cuenta (se suma con AND a las políticas existentes)
-- ============================================================================
alter table public.cuentas enable row level security;

-- Cada uno ve su cuenta; la plataforma ve todas. Se escribe solo desde la Edge
-- Function `cuentas` (clave de servicio)
create policy cuentas_select on public.cuentas
  for select to authenticated
  using (id = (select public.mi_cuenta()) or (select public.es_plataforma()));
grant select on public.cuentas to authenticated;

create policy aislar_cuenta on public.usuarios as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.clientes as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.oportunidades as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.actividades as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.auditoria as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.landings as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.landing_envios as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.landing_visitas as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.etiquetas as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.productos as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.canales as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.pedidos as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.pedido_historial as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));
create policy aislar_cuenta on public.pedido_avisos as restrictive
  for all to authenticated
  using (cuenta_id = (select public.mi_cuenta())) with check (cuenta_id = (select public.mi_cuenta()));

-- Imágenes de landings: cada cuenta en su carpeta (`<cuenta_id>/<archivo>`). Lo
-- subido antes de las cuentas está en la raíz del bucket y es de la principal (que
-- también puede seguir subiendo ahí, como hacía la versión anterior del CRM). La
-- misma condición vale para leer, subir y borrar.
create policy aislar_cuenta_imagenes on storage.objects as restrictive
  for all to authenticated
  using (
    bucket_id <> 'landing-imagenes'
    or split_part(name, '/', 1) = (select public.mi_cuenta())::text
    or (position('/' in name) = 0 and (select public.mi_cuenta()) = (select public.cuenta_principal()))
  )
  with check (
    bucket_id <> 'landing-imagenes'
    or split_part(name, '/', 1) = (select public.mi_cuenta())::text
    or (position('/' in name) = 0 and (select public.mi_cuenta()) = (select public.cuenta_principal()))
  );

-- ============================================================================
-- Reglas de usuarios por cuenta
-- ============================================================================
-- Debe quedar un administrador activo POR CUENTA; el usuario del sistema no se toca
create or replace function public.usuarios_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quedaria_sin_admin boolean;
begin
  if old.sistema then
    raise exception '«% %» es un usuario del sistema: no se modifica ni se borra', old.nombre, old.apellido
      using errcode = '42501';
  end if;

  quedaria_sin_admin := old.rol = 'administrador' and old.activo
    and not exists (
      select 1 from public.usuarios u
      where u.id <> old.id and u.cuenta_id = old.cuenta_id and u.rol = 'administrador' and u.activo
    );

  if tg_op = 'DELETE' then
    if quedaria_sin_admin then
      raise exception 'Debe quedar al menos un administrador activo' using errcode = 'P0001';
    end if;
    return old;
  end if;

  new.actualizado_en := now();
  if quedaria_sin_admin and (new.rol <> 'administrador' or not new.activo) then
    raise exception 'Debe quedar al menos un administrador activo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Máximo de usuarios activos de la cuenta. SECURITY DEFINER: cuenta a todos
create function public.usuarios_limite()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_activos integer;
begin
  if new.sistema or not new.activo then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.activo and old.cuenta_id = new.cuenta_id then
    return new;
  end if;
  -- FOR UPDATE: dos altas a la vez en la misma cuenta se hacen en fila y no superan el máximo
  select c.max_usuarios into v_max from public.cuentas c where c.id = new.cuenta_id for update;
  if v_max is null then
    return new;
  end if;
  select count(*) into v_activos
  from public.usuarios u
  where u.cuenta_id = new.cuenta_id and u.activo and not u.sistema and u.id <> new.id;
  if v_activos >= v_max then
    raise exception 'La cuenta llegó a su máximo de % usuarios activos', v_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_20_usuarios_limite
  before insert or update on public.usuarios
  for each row execute function public.usuarios_limite();
revoke all on function public.usuarios_limite() from public, anon, authenticated;

-- ============================================================================
-- Alta de una cuenta: canales que usa el sistema y el catálogo básico
-- ============================================================================
-- La llama la Edge Function `cuentas` (clave de servicio) al crear la cuenta.
create function public.cuenta_sembrar(p_cuenta bigint)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.canales (cuenta_id, nombre, clave) values
    (p_cuenta, 'WhatsApp', 'whatsapp'),
    (p_cuenta, 'Instagram', null),
    (p_cuenta, 'Facebook', null),
    (p_cuenta, 'Sitio web', null),
    (p_cuenta, 'Landing', 'landing'),
    (p_cuenta, 'Referido', null),
    (p_cuenta, 'Llamada', null),
    (p_cuenta, 'Email', null),
    (p_cuenta, 'Visita / local', null),
    (p_cuenta, 'Otro', null)
  on conflict do nothing;
$$;
revoke all on function public.cuenta_sembrar(bigint) from public, anon, authenticated;

-- Alta completa de una cuenta en UNA transacción: la cuenta, sus canales y el perfil
-- del administrador titular (cuya cuenta de acceso ya creó la Edge Function). Si algo
-- falla no queda nada a medias; solo hay que borrar la cuenta de acceso.
create function public.cuenta_alta(
  p_nombre text,
  p_modulos text[],
  p_max_usuarios integer,
  p_usuario uuid,
  p_email text,
  p_nombre_titular text,
  p_apellido_titular text
)
returns public.cuentas
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
begin
  insert into public.cuentas (nombre, modulos, max_usuarios)
  values (p_nombre, p_modulos, p_max_usuarios)
  returning * into v_cuenta;

  perform public.cuenta_sembrar(v_cuenta.id);

  insert into public.usuarios (id, cuenta_id, email, nombre, apellido, rol, activo, modulos)
  values (p_usuario, v_cuenta.id, p_email, p_nombre_titular, p_apellido_titular, 'administrador', true, p_modulos);

  return v_cuenta;
end;
$$;
revoke all on function public.cuenta_alta(text, text[], integer, uuid, text, text, text) from public, anon, authenticated;

-- ============================================================================
-- Quién es la plataforma: hasta ahora el sistema era de una sola empresa, así
-- que el administrador más antiguo (no el bot) es el dueño. Se cambia con:
--   update public.usuarios set plataforma = (email = 'otro@dominio') where rol = 'administrador';
-- ============================================================================
update public.usuarios set plataforma = true
where id = (
  select u.id from public.usuarios u
  where u.rol = 'administrador' and u.activo and not u.sistema
  order by u.creado_en, u.id
  limit 1
);

-- ============================================================================
-- Funciones que corren sin RLS (SECURITY DEFINER) o leen de otras tablas: se
-- vuelven a definir igual que la última versión, con el filtro por cuenta.
-- Cada una marca con su cuenta lo que lee: el cambio es solo ese filtro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Landings públicas: leen y escriben en la cuenta DE LA LANDING (el visitante no tiene sesión) y solo atienden si la cuenta está activa y tiene el módulo
-- ----------------------------------------------------------------------------
create or replace function public.landing_recibir(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_datos ->> 'slug', '')));
  v_landing public.landings;
  v_form jsonb;
  v_seguimiento jsonb;
  v_respuestas jsonb := coalesce(p_datos -> 'answers', '{}'::jsonb);
  v_utm jsonb := coalesce(p_datos -> 'utm', '{}'::jsonb);
  v_es_whatsapp boolean := p_datos ->> 'kind' = 'whatsapp';
  v_campo jsonb;
  v_valor text;
  v_tipo text;
  v_destino text;
  v_lineas text[] := '{}';
  v_nombre_completo text;
  v_nombre text;
  v_apellido text;
  v_empresa text;
  v_email text;
  v_telefono text;
  v_digitos text;
  v_palabras text[];
  v_consentimiento text;
  v_ip text;
  v_ip_hash text;
  v_admin uuid;
  v_responsable uuid;
  v_cliente_id bigint;
  v_cliente_nuevo boolean := false;
  v_tarea text;
  v_dias int;
  v_etiquetas bigint[];
  -- Pedido (carrito dentro del formulario)
  v_carrito jsonb;
  v_entrada jsonb := p_datos -> 'lineas';
  v_agrupadas jsonb;
  v_permitidos bigint[];
  v_linea jsonb;
  v_cantidad numeric;
  v_producto_id numeric;
  v_hay_pedido boolean := false;
  v_entrega text := p_datos ->> 'entrega';
  v_modo_entrega text;
  v_direccion text;
  v_clave text := nullif(left(btrim(coalesce(p_datos ->> 'clave', '')), 100), '');
  v_pedido public.pedidos;
  v_resumen text;
begin
  -- Solo los bots completan el campo trampa: reciben un ok y no se guarda nada
  if coalesce(p_datos ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;
  if v_slug = '' or jsonb_typeof(v_respuestas) <> 'object' or jsonb_typeof(v_utm) <> 'object' then
    raise exception 'invalid' using errcode = '22023';
  end if;

  -- Una visita nunca crea un cliente ni falla para el visitante
  if p_datos ->> 'event' = 'visit' then
    insert into public.landing_visitas as v (landing_id, dia, visitas)
    select l.id, (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1
    from public.landings l
    where l.slug = v_slug and l.estado = 'publicada'
      and public.cuenta_habilitada(l.cuenta_id, 'landings')
    on conflict (landing_id, dia) do update set visitas = v.visitas + 1;
    return jsonb_build_object('ok', true);
  end if;

  select * into v_landing from public.landings
  where slug = v_slug and estado = 'publicada'
    and public.cuenta_habilitada(cuenta_id, 'landings');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- 5 envíos por conexión cada 10 minutos
  v_ip := coalesce(
    nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'cf-connecting-ip', ''),
    nullif(btrim(split_part(
      coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-forwarded-for', ',', 1
    )), ''),
    'desconocida'
  );
  v_ip_hash := encode(sha256(convert_to(
    (select valor from privado.ajustes where clave = 'ip_sal') || ':' || v_ip, 'UTF8'
  )), 'hex');
  if (
    select count(*) from public.landing_envios
    where ip_hash = v_ip_hash and creado_en > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_form := v_landing.publicada -> 'form';
  v_carrito := v_landing.publicada -> 'carrito';
  v_seguimiento := coalesce(v_landing.publicada -> 'automation', '{}'::jsonb);
  -- Las etiquetas del seguimiento que siguen en el catálogo
  v_etiquetas := array(
    select e.id
    from jsonb_array_elements(
      case when jsonb_typeof(v_seguimiento -> 'tagIds') = 'array' then v_seguimiento -> 'tagIds' else '[]'::jsonb end
    ) as x(valor)
    join public.etiquetas e on jsonb_typeof(x.valor) = 'number' and e.id = (x.valor #>> '{}')::bigint
      and e.cuenta_id = v_landing.cuenta_id
  );

  if v_es_whatsapp then
    if coalesce((v_landing.publicada -> 'whatsapp' ->> 'enabled')::boolean, false) is not true then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_nombre_completo := left(btrim(coalesce(p_datos ->> 'name', '')), 120);
    v_telefono := left(btrim(coalesce(p_datos ->> 'phone', '')), 40);
    if v_nombre_completo = '' or length(regexp_replace(v_telefono, '\D', '', 'g')) < 6 then
      raise exception 'invalid' using errcode = '22023';
    end if;
    v_lineas := array['Pidió hablar por WhatsApp.'];
  else
    -- Cada pregunta, validada contra lo publicado (nunca contra lo que diga el visitante)
    for v_campo in select * from jsonb_array_elements(coalesce(v_form -> 'fields', '[]'::jsonb)) loop
      v_tipo := v_campo ->> 'type';
      v_destino := coalesce(v_campo ->> 'target', 'answer');
      v_valor := privado.texto_respuesta(v_respuestas -> (v_campo ->> 'id'));
      v_valor := left(v_valor, case when v_tipo = 'textarea' then 2000 else 300 end);

      if v_valor = '' then
        if coalesce((v_campo ->> 'required')::boolean, false) then
          raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
        end if;
        continue;
      end if;
      if v_tipo in ('select', 'radio') and not (coalesce(v_campo -> 'options', '[]'::jsonb) ? v_valor) then
        raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
      end if;
      if (v_tipo = 'email' or v_destino = 'email') and v_valor !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
      end if;
      if (v_tipo = 'phone' or v_destino = 'phone') and length(regexp_replace(v_valor, '\D', '', 'g')) not between 6 and 15 then
        raise exception 'invalid' using errcode = '22023', detail = v_campo ->> 'id';
      end if;

      case v_destino
        when 'full_name' then v_nombre_completo := v_valor;
        when 'first_name' then v_nombre := v_valor;
        when 'last_name' then v_apellido := v_valor;
        when 'email' then v_email := lower(v_valor);
        when 'phone' then v_telefono := v_valor;
        when 'company' then v_empresa := v_valor;
        else null;
      end case;
      if v_destino not in ('full_name', 'first_name', 'last_name', 'email', 'phone') then
        v_lineas := v_lineas || ((v_campo ->> 'label') || ': ' || v_valor);
      end if;
    end loop;

    if coalesce((v_form -> 'consent' ->> 'enabled')::boolean, true)
       and btrim(coalesce(v_form -> 'consent' ->> 'text', '')) <> '' then
      if coalesce(p_datos ->> 'consent', 'false') <> 'true' then
        raise exception 'invalid' using errcode = '22023', detail = 'consent';
      end if;
      v_consentimiento := v_form -> 'consent' ->> 'text';
    end if;

    -- Pedido opcional: sin líneas es solo una consulta, como siempre
    if v_entrada is not null and v_entrada <> 'null'::jsonb then
      if jsonb_typeof(v_entrada) <> 'array' then
        raise exception 'Hay un producto del pedido con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
      end if;
      v_hay_pedido := jsonb_array_length(v_entrada) > 0;
    end if;

    if v_hay_pedido then
      if coalesce((v_carrito ->> 'activo')::boolean, false) is not true
         or not public.cuenta_habilitada(v_landing.cuenta_id, 'pedidos') then
        raise exception 'El pedido no está disponible en esta página' using errcode = '22023', hint = 'landing_pedido';
      end if;
      if jsonb_array_length(v_entrada) > 30 then
        raise exception 'El pedido admite hasta 30 productos distintos' using errcode = '22023', hint = 'landing_pedido';
      end if;

      -- Entrega: la decide la configuración PUBLICADA de la landing, no el visitante
      --   'ninguna': se ignora lo que mande y el pedido queda "a coordinar" (NULL)
      --   'envio' / 'retiro': se fuerza ese tipo
      --   'elegir' (o ausente): elige el visitante, es obligatorio
      v_modo_entrega := coalesce(v_carrito ->> 'entrega', 'elegir');
      if v_modo_entrega not in ('elegir', 'envio', 'retiro', 'ninguna') then
        v_modo_entrega := 'elegir';
      end if;
      if v_modo_entrega = 'ninguna' then
        v_entrega := null;
        v_direccion := null;
      else
        if v_modo_entrega in ('envio', 'retiro') then
          v_entrega := v_modo_entrega;
        end if;
        if v_entrega is null or v_entrega not in ('envio', 'retiro') then
          raise exception 'Elegí si es envío o retiro' using errcode = '22023', hint = 'landing_pedido';
        end if;
        v_direccion := nullif(left(btrim(coalesce(p_datos ->> 'direccion', '')), 300), '');
        if v_entrega = 'envio' and v_direccion is null then
          raise exception 'Escribí la dirección de entrega' using errcode = '22023', hint = 'landing_pedido';
        end if;
        if v_entrega = 'retiro' then
          v_direccion := null;
        end if;
      end if;

      -- Cantidades enteras de 1 a 99
      for v_linea in select value from jsonb_array_elements(v_entrada) loop
        if jsonb_typeof(v_linea) is distinct from 'object'
           or jsonb_typeof(v_linea -> 'producto_id') is distinct from 'number'
           or jsonb_typeof(v_linea -> 'cantidad') is distinct from 'number' then
          raise exception 'Hay un producto del pedido con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
        end if;
        v_producto_id := (v_linea ->> 'producto_id')::numeric;
        v_cantidad := (v_linea ->> 'cantidad')::numeric;
        if v_producto_id <> trunc(v_producto_id) or v_producto_id < 1 or v_producto_id > 9007199254740991 then
          raise exception 'Hay un producto del pedido con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
        end if;
        if v_cantidad <> trunc(v_cantidad) or v_cantidad < 1 or v_cantidad > 99 then
          raise exception 'La cantidad de cada producto debe ser de 1 a 99' using errcode = '22023', hint = 'landing_pedido';
        end if;
      end loop;

      -- Un mismo producto repetido se suma
      select jsonb_agg(jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad) order by t.producto_id)
        into v_agrupadas
      from (
        select (l.valor ->> 'producto_id')::bigint as producto_id, sum((l.valor ->> 'cantidad')::numeric) as cantidad
        from jsonb_array_elements(v_entrada) as l(valor)
        group by 1
      ) t;
      if exists (select 1 from jsonb_array_elements(v_agrupadas) as l(valor) where (l.valor ->> 'cantidad')::numeric > 99) then
        raise exception 'La cantidad de cada producto debe ser de 1 a 99' using errcode = '22023', hint = 'landing_pedido';
      end if;

      -- Productos activos y, si la landing lo restringe, de los permitidos
      v_permitidos := array(
        select (x.valor #>> '{}')::bigint
        from jsonb_array_elements(
          case when jsonb_typeof(v_carrito -> 'productoIds') = 'array' then v_carrito -> 'productoIds' else '[]'::jsonb end
        ) as x(valor)
        where jsonb_typeof(x.valor) = 'number'
      );
      if exists (
        select 1
        from jsonb_array_elements(v_agrupadas) as l(valor)
        left join public.productos p on p.id = (l.valor ->> 'producto_id')::bigint
          and p.cuenta_id = v_landing.cuenta_id
        where p.id is null
           or not p.activo
           or (cardinality(v_permitidos) > 0 and p.id <> all (v_permitidos))
      ) then
        raise exception 'Alguno de los productos ya no está disponible: actualizá la página y elegí de nuevo'
          using errcode = '22023', hint = 'landing_pedido';
      end if;

      -- Para un pedido hace falta cómo contactar al cliente
      if v_nombre_completo is null and v_nombre is null and v_email is null and v_telefono is null then
        raise exception 'Completá tus datos de contacto para hacer el pedido' using errcode = '22023', hint = 'landing_pedido';
      end if;
    end if;
  end if;

  -- Reintento del mismo pedido (corte de red, doble toque): ya está guardado, se
  -- devuelve tal cual y no se vuelve a crear cliente, actividad ni envío
  if v_hay_pedido and v_clave is not null then
    select * into v_pedido from public.pedidos
    where clave_idempotencia = v_clave and cuenta_id = v_landing.cuenta_id;
    if found then
      return jsonb_build_object(
        'ok', true,
        'pedido_id', v_pedido.id,
        'total', v_pedido.total,
        'lineas', (
          select jsonb_agg(
            jsonb_build_object(
              'nombre', l.valor ->> 'nombre',
              'cantidad', (l.valor ->> 'cantidad')::numeric,
              'precio', (l.valor ->> 'precio_unitario')::numeric,
              'subtotal', (l.valor ->> 'subtotal')::numeric
            ) order by l.posicion
          )
          from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
        )
      );
    end if;
  end if;

  -- "Juan Pablo Pérez": el apellido es la última palabra
  if v_nombre is null and v_nombre_completo is not null then
    v_palabras := regexp_split_to_array(btrim(regexp_replace(v_nombre_completo, '\s+', ' ', 'g')), ' ');
    if array_length(v_palabras, 1) > 1 then
      v_nombre := array_to_string(v_palabras[1:array_length(v_palabras, 1) - 1], ' ');
      v_apellido := coalesce(v_apellido, v_palabras[array_length(v_palabras, 1)]);
    else
      v_nombre := v_palabras[1];
    end if;
  end if;

  v_digitos := nullif(regexp_replace(coalesce(v_telefono, ''), '\D', '', 'g'), '');
  if length(v_digitos) < 8 then
    v_digitos := null;
  end if;

  -- El mismo cliente si coincide el email o el teléfono (últimos 10 dígitos)
  select c.id into v_cliente_id
  from (select * from public.clientes where cuenta_id = v_landing.cuenta_id) c
  where (v_email is not null and lower(c.email) = v_email)
     or (
       v_digitos is not null
       and length(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g')) >= 8
       and right(regexp_replace(c.telefono, '\D', '', 'g'), least(10, length(v_digitos)))
           = right(v_digitos, least(10, length(regexp_replace(c.telefono, '\D', '', 'g'))))
     )
  order by coalesce(v_email is not null and lower(c.email) = v_email, false) desc, c.creado_en
  limit 1;

  -- El administrador elegido en la landing, si sigue activo; si no, el primero
  select u.id into v_admin
  from public.usuarios u
  where u.rol = 'administrador' and u.activo and not u.sistema and u.cuenta_id = v_landing.cuenta_id
  order by coalesce(u.id::text = (v_seguimiento ->> 'adminId'), false) desc, u.creado_en
  limit 1;

  -- Lo que se escribe desde acá queda en la auditoría con este origen
  perform set_config('crm.origen', 'Landing «' || v_landing.nombre || '»', true);

  if v_cliente_id is null then
    insert into public.clientes (tipo, nombre, apellido, razon_social, email, telefono, direccion, asignado_a, landing_id, etiquetas)
    values (
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then 'empresa' else 'persona' end,
      case when coalesce(v_nombre, '') = '' and v_empresa is not null then null
           else coalesce(nullif(v_nombre, ''), v_email, v_telefono, 'Sin nombre') end,
      nullif(v_apellido, ''),
      case when coalesce(v_nombre, '') = '' then v_empresa end,
      v_email,
      nullif(v_telefono, ''),
      v_direccion,
      v_admin,
      v_landing.id,
      v_etiquetas
    )
    returning id into v_cliente_id;
    v_cliente_nuevo := true;
    v_responsable := v_admin;
  else
    -- Si ya tiene responsable activo, el seguimiento es suyo
    select coalesce(u.id, v_admin) into v_responsable
    from public.clientes c
    left join public.usuarios u on u.id = c.asignado_a and u.activo
    where c.id = v_cliente_id;

    -- Suma las de la landing a las que ya tenía
    update public.clientes
    set etiquetas = etiquetas || v_etiquetas
    where id = v_cliente_id and not etiquetas @> v_etiquetas;
  end if;

  if v_consentimiento is not null then
    v_lineas := v_lineas || ('Aceptó: ' || v_consentimiento);
  end if;
  if coalesce(v_utm ->> 'utm_source', v_utm ->> 'utm_campaign') is not null then
    v_lineas := v_lineas || ('Campaña: ' || concat_ws(' / ', v_utm ->> 'utm_source', v_utm ->> 'utm_campaign'));
  end if;

  insert into public.actividades (tipo, cliente_id, titulo, descripcion, asignados)
  values (
    'nota',
    v_cliente_id,
    case when v_es_whatsapp then 'WhatsApp desde la landing «' else 'Formulario de la landing «' end
      || v_landing.nombre || '»',
    nullif(array_to_string(v_lineas, E'\n'), ''),
    array[v_responsable]
  );

  v_tarea := btrim(coalesce(v_seguimiento ->> 'taskTitle', ''));
  if v_tarea <> '' then
    v_dias := least(365, greatest(0, coalesce((v_seguimiento ->> 'taskDueInDays')::int, 1)));
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignados)
    values ('tarea', v_cliente_id, left(v_tarea, 200), now() + make_interval(days => v_dias), array[v_responsable]);
  end if;

  -- El pedido: los precios los toma la base (pedidos_preparar completa nombre,
  -- precio y subtotal a partir de producto y cantidad)
  if v_hay_pedido then
    insert into public.pedidos (cliente_id, origen, tipo_entrega, direccion, productos, clave_idempotencia)
    values (v_cliente_id, 'landing', v_entrega, v_direccion, v_agrupadas, v_clave)
    returning * into v_pedido;

    v_resumen := (
      select string_agg(
        (l.valor ->> 'cantidad') || ' × ' || (l.valor ->> 'nombre') || ' ($ ' || (l.valor ->> 'subtotal') || ')',
        E'\n' order by l.posicion
      )
      from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
    );
    insert into public.actividades (tipo, cliente_id, titulo, descripcion, asignados)
    values (
      'nota',
      v_cliente_id,
      'Pedido #' || v_pedido.id || ' de la landing «' || v_landing.nombre || '»',
      concat_ws(
        E'\n',
        v_resumen,
        'Total: $ ' || v_pedido.total,
        case v_entrega
          when 'envio' then 'Envío a: ' || v_direccion
          when 'retiro' then 'Retira en el local'
          else 'Entrega a coordinar'
        end
      ),
      array[v_responsable]
    );
  end if;

  insert into public.landing_envios (
    landing_id, landing_slug, cliente_id, tipo, cliente_nuevo,
    consentimiento_en, consentimiento_texto, utm_source, utm_campaign, ip_hash
  )
  values (
    v_landing.id, v_slug, v_cliente_id,
    case when v_es_whatsapp then 'whatsapp' else 'formulario' end,
    v_cliente_nuevo,
    case when v_consentimiento is not null then now() end,
    v_consentimiento,
    left(nullif(btrim(v_utm ->> 'utm_source'), ''), 100),
    left(nullif(btrim(v_utm ->> 'utm_campaign'), ''), 100),
    v_ip_hash
  );

  if v_hay_pedido then
    return jsonb_build_object(
      'ok', true,
      'pedido_id', v_pedido.id,
      'total', v_pedido.total,
      'lineas', (
        select jsonb_agg(
          jsonb_build_object(
            'nombre', l.valor ->> 'nombre',
            'cantidad', (l.valor ->> 'cantidad')::numeric,
            'precio', (l.valor ->> 'precio_unitario')::numeric,
            'subtotal', (l.valor ->> 'subtotal')::numeric
          ) order by l.posicion
        )
        from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
      )
    );
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.landing_pedido(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_datos ->> 'slug', '')));
  v_landing public.landings;
  v_carrito jsonb;
  v_seguimiento jsonb;
  v_utm jsonb := coalesce(p_datos -> 'utm', '{}'::jsonb);
  v_entrada jsonb;
  v_agrupadas jsonb;
  v_permitidos bigint[];
  v_linea jsonb;
  v_cantidad numeric;
  v_producto_id numeric;
  v_entrega text := p_datos ->> 'entrega';
  v_direccion text;
  v_nota text;
  v_nombre_completo text;
  v_nombre text;
  v_apellido text;
  v_email text;
  v_telefono text;
  v_digitos text;
  v_palabras text[];
  v_ip text;
  v_ip_hash text;
  v_admin uuid;
  v_responsable uuid;
  v_cliente_id bigint;
  v_cliente_nuevo boolean := false;
  v_etiquetas bigint[];
  v_pedido public.pedidos;
  v_resumen text;
  v_tarea text;
  v_dias int;
begin
  -- Solo los bots completan el campo trampa: reciben un ok y no se guarda nada
  if jsonb_typeof(p_datos) is distinct from 'object' then
    raise exception 'Los datos del pedido no son válidos' using errcode = '22023', hint = 'landing_pedido';
  end if;
  if coalesce(p_datos ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true);
  end if;
  if v_slug = '' or jsonb_typeof(v_utm) <> 'object' then
    raise exception 'Los datos del pedido no son válidos' using errcode = '22023', hint = 'landing_pedido';
  end if;

  select * into v_landing from public.landings
  where slug = v_slug and estado = 'publicada'
    and public.cuenta_habilitada(cuenta_id, 'landings');
  if not found then
    raise exception 'Esta página no está disponible' using errcode = 'P0002', hint = 'landing_pedido', detail = 'not_found';
  end if;
  v_carrito := v_landing.publicada -> 'carrito';
  if coalesce((v_carrito ->> 'activo')::boolean, false) is not true
     or not public.cuenta_habilitada(v_landing.cuenta_id, 'pedidos') then
    raise exception 'El carrito no está disponible en esta página' using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- Datos del comprador
  v_nombre_completo := left(regexp_replace(btrim(coalesce(p_datos ->> 'nombre', '')), '\s+', ' ', 'g'), 120);
  if v_nombre_completo = '' then
    raise exception 'Escribí tu nombre' using errcode = '22023', hint = 'landing_pedido';
  end if;
  v_telefono := left(btrim(coalesce(p_datos ->> 'telefono', '')), 40);
  v_digitos := regexp_replace(v_telefono, '\D', '', 'g');
  if length(v_digitos) not between 8 and 15 then
    raise exception 'Escribí un teléfono válido, con código de área' using errcode = '22023', hint = 'landing_pedido';
  end if;
  v_email := nullif(lower(btrim(coalesce(p_datos ->> 'email', ''))), '');
  if v_email is not null and (length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'El email no es válido' using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- Entrega
  if v_entrega is null or v_entrega not in ('envio', 'retiro') then
    raise exception 'Elegí si es envío o retiro' using errcode = '22023', hint = 'landing_pedido';
  end if;
  v_direccion := nullif(left(btrim(coalesce(p_datos ->> 'direccion', '')), 300), '');
  if v_entrega = 'envio' and v_direccion is null then
    raise exception 'Escribí la dirección de entrega' using errcode = '22023', hint = 'landing_pedido';
  end if;
  if v_entrega = 'retiro' then
    v_direccion := null;
  end if;
  v_nota := nullif(left(btrim(coalesce(p_datos ->> 'nota', '')), 500), '');

  -- Carrito: 1 a 30 líneas, cantidades enteras de 1 a 99
  v_entrada := p_datos -> 'lineas';
  if jsonb_typeof(v_entrada) is distinct from 'array' or jsonb_array_length(v_entrada) = 0 then
    raise exception 'Tu carrito está vacío' using errcode = '22023', hint = 'landing_pedido';
  end if;
  if jsonb_array_length(v_entrada) > 30 then
    raise exception 'El carrito admite hasta 30 productos distintos' using errcode = '22023', hint = 'landing_pedido';
  end if;
  for v_linea in select value from jsonb_array_elements(v_entrada) loop
    if jsonb_typeof(v_linea) is distinct from 'object'
       or jsonb_typeof(v_linea -> 'producto_id') is distinct from 'number'
       or jsonb_typeof(v_linea -> 'cantidad') is distinct from 'number' then
      raise exception 'Hay un producto del carrito con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
    end if;
    v_producto_id := (v_linea ->> 'producto_id')::numeric;
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    if v_producto_id <> trunc(v_producto_id) or v_producto_id < 1 or v_producto_id > 9007199254740991 then
      raise exception 'Hay un producto del carrito con datos inválidos' using errcode = '22023', hint = 'landing_pedido';
    end if;
    if v_cantidad <> trunc(v_cantidad) or v_cantidad < 1 or v_cantidad > 99 then
      raise exception 'La cantidad de cada producto debe ser de 1 a 99' using errcode = '22023', hint = 'landing_pedido';
    end if;
  end loop;

  -- Un mismo producto repetido se suma
  select jsonb_agg(jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad) order by t.producto_id)
    into v_agrupadas
  from (
    select (l.valor ->> 'producto_id')::bigint as producto_id, sum((l.valor ->> 'cantidad')::numeric) as cantidad
    from jsonb_array_elements(v_entrada) as l(valor)
    group by 1
  ) t;
  if exists (select 1 from jsonb_array_elements(v_agrupadas) as l(valor) where (l.valor ->> 'cantidad')::numeric > 99) then
    raise exception 'La cantidad de cada producto debe ser de 1 a 99' using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- Productos activos y, si la landing lo restringe, de los permitidos
  v_permitidos := array(
    select (x.valor #>> '{}')::bigint
    from jsonb_array_elements(
      case when jsonb_typeof(v_carrito -> 'productoIds') = 'array' then v_carrito -> 'productoIds' else '[]'::jsonb end
    ) as x(valor)
    where jsonb_typeof(x.valor) = 'number'
  );
  if exists (
    select 1
    from jsonb_array_elements(v_agrupadas) as l(valor)
    left join public.productos p on p.id = (l.valor ->> 'producto_id')::bigint
          and p.cuenta_id = v_landing.cuenta_id
    where p.id is null
       or not p.activo
       or (cardinality(v_permitidos) > 0 and p.id <> all (v_permitidos))
  ) then
    raise exception 'Alguno de los productos ya no está disponible: actualizá la página y armá el carrito de nuevo'
      using errcode = '22023', hint = 'landing_pedido';
  end if;

  -- 5 envíos por conexión cada 10 minutos (el mismo límite que landing_recibir)
  v_ip := coalesce(
    nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'cf-connecting-ip', ''),
    nullif(btrim(split_part(
      coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-forwarded-for', ',', 1
    )), ''),
    'desconocida'
  );
  v_ip_hash := encode(sha256(convert_to(
    (select valor from privado.ajustes where clave = 'ip_sal') || ':' || v_ip, 'UTF8'
  )), 'hex');
  if (
    select count(*) from public.landing_envios
    where ip_hash = v_ip_hash and creado_en > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Hiciste varios pedidos desde tu conexión: volvé a intentarlo en unos minutos'
      using errcode = 'P0001', hint = 'landing_pedido', detail = 'rate_limited';
  end if;

  v_seguimiento := coalesce(v_landing.publicada -> 'automation', '{}'::jsonb);
  v_etiquetas := array(
    select e.id
    from jsonb_array_elements(
      case when jsonb_typeof(v_seguimiento -> 'tagIds') = 'array' then v_seguimiento -> 'tagIds' else '[]'::jsonb end
    ) as x(valor)
    join public.etiquetas e on jsonb_typeof(x.valor) = 'number' and e.id = (x.valor #>> '{}')::bigint
      and e.cuenta_id = v_landing.cuenta_id
  );

  -- "Juan Pablo Pérez": el apellido es la última palabra
  v_palabras := regexp_split_to_array(v_nombre_completo, ' ');
  if array_length(v_palabras, 1) > 1 then
    v_nombre := array_to_string(v_palabras[1:array_length(v_palabras, 1) - 1], ' ');
    v_apellido := v_palabras[array_length(v_palabras, 1)];
  else
    v_nombre := v_palabras[1];
  end if;

  -- El mismo cliente si coincide el email o el teléfono (últimos 10 dígitos)
  select c.id into v_cliente_id
  from (select * from public.clientes where cuenta_id = v_landing.cuenta_id) c
  where (v_email is not null and lower(c.email) = v_email)
     or (
       length(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g')) >= 8
       and right(regexp_replace(c.telefono, '\D', '', 'g'), least(10, length(v_digitos)))
           = right(v_digitos, least(10, length(regexp_replace(c.telefono, '\D', '', 'g'))))
     )
  order by coalesce(v_email is not null and lower(c.email) = v_email, false) desc, c.creado_en
  limit 1;

  -- El administrador elegido en la landing, si sigue activo; si no, el primero
  select u.id into v_admin
  from public.usuarios u
  where u.rol = 'administrador' and u.activo and not u.sistema and u.cuenta_id = v_landing.cuenta_id
  order by coalesce(u.id::text = (v_seguimiento ->> 'adminId'), false) desc, u.creado_en
  limit 1;

  -- Lo que se escribe desde acá queda en la auditoría con este origen
  perform set_config('crm.origen', 'Landing «' || v_landing.nombre || '»', true);

  if v_cliente_id is null then
    -- Canal «Landing»: lo pone clientes_canal por el landing_id
    insert into public.clientes (tipo, nombre, apellido, email, telefono, direccion, asignado_a, landing_id, etiquetas)
    values (
      'persona', v_nombre, v_apellido, v_email, v_telefono, v_direccion, v_admin, v_landing.id, v_etiquetas
    )
    returning id into v_cliente_id;
    v_cliente_nuevo := true;
    v_responsable := v_admin;
  else
    -- Si ya tiene responsable activo, el seguimiento es suyo
    select coalesce(u.id, v_admin) into v_responsable
    from public.clientes c
    left join public.usuarios u on u.id = c.asignado_a and u.activo
    where c.id = v_cliente_id;

    update public.clientes
    set etiquetas = etiquetas || v_etiquetas
    where id = v_cliente_id and not etiquetas @> v_etiquetas;
  end if;

  -- Los precios los toma la base: viajan solo producto y cantidad y
  -- pedidos_preparar (armar_lineas) completa nombre, precio y subtotal
  insert into public.pedidos (cliente_id, origen, tipo_entrega, direccion, productos, nota)
  values (v_cliente_id, 'landing', v_entrega, v_direccion, v_agrupadas, v_nota)
  returning * into v_pedido;

  v_resumen := (
    select string_agg(
      (l.valor ->> 'cantidad') || ' × ' || (l.valor ->> 'nombre') || ' ($ ' || (l.valor ->> 'subtotal') || ')',
      E'\n' order by l.posicion
    )
    from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
  );
  insert into public.actividades (tipo, cliente_id, titulo, descripcion, asignados)
  values (
    'nota',
    v_cliente_id,
    'Pedido #' || v_pedido.id || ' de la landing «' || v_landing.nombre || '»',
    concat_ws(
      E'\n',
      v_resumen,
      'Total: $ ' || v_pedido.total,
      case v_entrega when 'envio' then 'Envío a: ' || v_direccion else 'Retira en el local' end,
      case when v_nota is not null then 'Nota: ' || v_nota end,
      case when coalesce(v_utm ->> 'utm_source', v_utm ->> 'utm_campaign') is not null
        then 'Campaña: ' || concat_ws(' / ', v_utm ->> 'utm_source', v_utm ->> 'utm_campaign') end
    ),
    array[v_responsable]
  );

  v_tarea := btrim(coalesce(v_seguimiento ->> 'taskTitle', ''));
  if v_tarea <> '' then
    v_dias := least(365, greatest(0, coalesce((v_seguimiento ->> 'taskDueInDays')::int, 1)));
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignados)
    values ('tarea', v_cliente_id, left(v_tarea, 200), now() + make_interval(days => v_dias), array[v_responsable]);
  end if;

  insert into public.landing_envios (
    landing_id, landing_slug, cliente_id, tipo, cliente_nuevo, utm_source, utm_campaign, ip_hash
  )
  values (
    v_landing.id, v_slug, v_cliente_id, 'pedido', v_cliente_nuevo,
    left(nullif(btrim(v_utm ->> 'utm_source'), ''), 100),
    left(nullif(btrim(v_utm ->> 'utm_campaign'), ''), 100),
    v_ip_hash
  );

  return jsonb_build_object(
    'pedido_id', v_pedido.id,
    'total', v_pedido.total,
    'lineas', (
      select jsonb_agg(
        jsonb_build_object(
          'nombre', l.valor ->> 'nombre',
          'cantidad', (l.valor ->> 'cantidad')::numeric,
          'precio', (l.valor ->> 'precio_unitario')::numeric,
          'subtotal', (l.valor ->> 'subtotal')::numeric
        ) order by l.posicion
      )
      from jsonb_array_elements(v_pedido.productos) with ordinality as l(valor, posicion)
    )
  );
end;
$$;

create or replace function public.landing_productos(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with landing as (
    select l.publicada -> 'carrito' as carrito, l.cuenta_id
    from public.landings l
    where l.slug = lower(btrim(p_slug)) and l.estado = 'publicada'
      and public.cuenta_habilitada(l.cuenta_id, 'landings')
  ),
  permitidos as (
    select array(
      select (x.valor #>> '{}')::bigint
      from landing,
        jsonb_array_elements(
          case when jsonb_typeof(landing.carrito -> 'productoIds') = 'array'
            then landing.carrito -> 'productoIds' else '[]'::jsonb end
        ) as x(valor)
      where jsonb_typeof(x.valor) = 'number'
    ) as ids
  )
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio)
        order by p.nombre
      )
      from landing, permitidos, public.productos p
      where coalesce((landing.carrito ->> 'activo')::boolean, false) is true
        and public.cuenta_habilitada(landing.cuenta_id, 'pedidos')
        and p.cuenta_id = landing.cuenta_id
        and p.activo
        and (cardinality(permitidos.ids) = 0 or p.id = any (permitidos.ids))
    ),
    '[]'::jsonb
  )
$$;

create or replace function public.landing_publica(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('id', id, 'nombre', nombre, 'slug', slug, 'contenido', publicada - 'automation')
  from public.landings
  where slug = lower(btrim(p_slug)) and estado = 'publicada'
    and public.cuenta_habilitada(cuenta_id, 'landings')
$$;

-- ----------------------------------------------------------------------------
-- Pedidos: la venta y el cambio de estado respetan la cuenta del pedido
-- ----------------------------------------------------------------------------
create or replace function public.pedidos_estado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_origen text := coalesce(current_setting('crm.origen', true), '');
  v_motivo text := nullif(btrim(current_setting('crm.motivo_estado', true)), '');
  v_responsable uuid;
begin
  if tg_op = 'INSERT' and new.estado <> 'nuevo' then
    raise exception 'Un pedido empieza en «Nuevo»' using errcode = '23514';
  end if;
  if new.estado = 'en_camino' and new.tipo_entrega = 'retiro' then
    raise exception 'Un pedido para retirar no va «En camino»: usá «Listo para retirar»'
      using errcode = '23514';
  end if;
  if new.estado = 'listo_para_retirar' and new.tipo_entrega = 'envio' then
    raise exception 'Un pedido con envío no queda «Listo para retirar»: usá «En camino»'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.entregado_en := null;
    return new;
  end if;
  if new.estado = old.estado then
    new.entregado_en := old.entregado_en;
    return new;
  end if;

  if old.estado = 'entregado' then
    if v_motivo is null then
      raise exception 'Para revertir una entrega indicá el motivo' using errcode = '23514';
    end if;
    perform set_config('crm.origen', 'Pedido #' || old.id || ' revertido', true);
    delete from public.oportunidades where pedido_id = old.id;
    perform set_config('crm.origen', v_origen, true);
    new.entregado_en := null;
  end if;

  if new.estado = 'entregado' then
    new.entregado_en := now();
    if not new.prueba then
      if new.origen = 'landing' then
        select u.id into v_responsable
        from public.usuarios u
        where u.activo and not u.sistema and u.cuenta_id = new.cuenta_id
          and (
            u.id = (select c.asignado_a from public.clientes c where c.id = new.cliente_id)
            or u.rol = 'administrador'
          )
        order by
          (u.id = (select c.asignado_a from public.clientes c where c.id = new.cliente_id)) desc,
          u.creado_en
        limit 1;
      end if;

      perform set_config('crm.origen', 'Pedido #' || new.id, true);
      insert into public.oportunidades (
        cliente_id, productos, canal_id, etapa, resultado, fecha_cierre, asignados, descripcion, pedido_id
      )
      values (
        new.cliente_id,
        new.productos,
        -- Manual: el canal del cliente (oportunidades_canal)
        case new.origen
          when 'whatsapp' then (select ca.id from public.canales ca where ca.clave = 'whatsapp' and ca.cuenta_id = new.cuenta_id)
          when 'landing' then (select ca.id from public.canales ca where ca.clave = 'landing' and ca.cuenta_id = new.cuenta_id)
        end,
        'negociacion',
        'ganada',
        (new.entregado_en at time zone 'America/Argentina/Buenos_Aires')::date,
        -- Manual: quien lo entrega (asignar_por_defecto)
        case new.origen
          when 'whatsapp' then array[public.usuario_bot()]
          when 'landing' then coalesce(array[v_responsable], '{}'::uuid[])
          else '{}'::uuid[]
        end,
        'Pedido #' || new.id,
        new.id
      );
      perform set_config('crm.origen', v_origen, true);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.pedido_cambiar_estado(p_id bigint, p_estado text, p_motivo text default null)
returns public.pedidos
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  if (select auth.uid()) is not null and not (select public.tiene_modulo('pedidos')) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;
  if p_estado is null or p_estado not in (
    'nuevo', 'en_preparacion', 'en_camino', 'listo_para_retirar', 'entregado', 'cancelado'
  ) then
    raise exception 'Estado de pedido inválido' using errcode = '22023';
  end if;

  perform set_config('crm.motivo_estado', coalesce(btrim(p_motivo), ''), true);
  update public.pedidos set estado = p_estado
   where id = p_id
     and ((select auth.uid()) is null or cuenta_id = (select public.mi_cuenta()))
  returning * into v_pedido;
  perform set_config('crm.motivo_estado', '', true);

  if v_pedido.id is null then
    raise exception 'El pedido no existe' using errcode = 'P0002';
  end if;
  return v_pedido;
end;
$$;

-- ----------------------------------------------------------------------------
-- Canal «Landing» del cliente nuevo: el de su cuenta
-- ----------------------------------------------------------------------------
create or replace function public.clientes_canal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.canal_id is null and new.landing_id is not null then
    new.canal_id := (select id from public.canales where clave = 'landing' and cuenta_id = new.cuenta_id);
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Publicar y despublicar: solo las landings de la cuenta de quien las pide
-- ----------------------------------------------------------------------------
create or replace function public.landing_publicar(p_id bigint)
returns public.landings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_landing public.landings;
begin
  if not (select public.tiene_modulo('landings')) then
    raise exception 'No tenés permiso para publicar landings' using errcode = '42501';
  end if;
  update public.landings
     set estado = 'publicada', publicada = borrador, publicada_en = now(), publicada_por = (select auth.uid())
   where id = p_id and cuenta_id = (select public.mi_cuenta())
  returning * into v_landing;
  if not found then
    raise exception 'La landing no existe' using errcode = 'P0002';
  end if;
  return v_landing;
end;
$$;

create or replace function public.landing_despublicar(p_id bigint)
returns public.landings
language plpgsql security definer
set search_path = ''
as $$
declare
  v_landing public.landings;
begin
  if not (select public.tiene_modulo('landings')) then
    raise exception 'No tenés permiso para despublicar landings' using errcode = '42501';
  end if;
  update public.landings set estado = 'borrador'
   where id = p_id and cuenta_id = (select public.mi_cuenta())
  returning * into v_landing;
  if not found then
    raise exception 'La landing no existe' using errcode = 'P0002';
  end if;
  return v_landing;
end;
$$;

-- ----------------------------------------------------------------------------
-- Auditoría: cada registro queda en la cuenta de la propia fila (no la de quien actúa)
-- ----------------------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  fila jsonb;
  antes jsonb;
  diferencias jsonb;
  v_accion text;
  v_cuenta bigint;
begin
  if tg_op = 'INSERT' then
    fila := to_jsonb(new);
    v_accion := 'crear';
    diferencias := fila;
  elsif tg_op = 'DELETE' then
    fila := to_jsonb(old);
    v_accion := 'eliminar';
    diferencias := fila;
  else
    antes := to_jsonb(old);
    fila := to_jsonb(new);
    v_accion := 'editar';
    select coalesce(
             jsonb_object_agg(n.key, jsonb_build_object('antes', antes -> n.key, 'despues', n.value)),
             '{}'::jsonb
           )
      into diferencias
      from jsonb_each(fila) as n
     where n.key not in ('actualizado_en', 'actualizado_por')
       and (antes -> n.key) is distinct from n.value;
    -- Un UPDATE que no cambió nada no se registra
    if diferencias = '{}'::jsonb then
      return null;
    end if;
  end if;

  -- La cuenta es la de la propia fila, no la de quien actúa: sin sesión (clave de servicio,
  -- psql) no hay a quién atribuirla, y un borrado en cascada ya no encuentra a su cliente.
  v_cuenta := (fila ->> 'cuenta_id')::bigint;
  diferencias := diferencias - 'cuenta_id';

  insert into public.auditoria (cuenta_id, usuario_id, entidad, registro_id, cliente_id, accion, descripcion, cambios, origen)
  values (
    v_cuenta,
    (select auth.uid()),
    tg_table_name,
    fila ->> 'id',
    case when tg_table_name = 'clientes' then (fila ->> 'id')::bigint else (fila ->> 'cliente_id')::bigint end,
    v_accion,
    coalesce(fila ->> 'nombre_completo', fila ->> 'producto_servicio', fila ->> 'titulo'),
    diferencias,
    nullif(current_setting('crm.origen', true), '')
  );
  return null;
end;
$$;

create or replace function public.landings_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_cuenta bigint;
  v_nombre text;
  v_accion text;
  v_cambios jsonb;
begin
  if tg_op = 'INSERT' then
    v_id := new.id;
    v_cuenta := new.cuenta_id;
    v_nombre := new.nombre;
    v_accion := 'crear';
    v_cambios := jsonb_build_object('nombre', new.nombre, 'slug', new.slug);
  elsif tg_op = 'DELETE' then
    v_id := old.id;
    v_cuenta := old.cuenta_id;
    v_nombre := old.nombre;
    v_accion := 'eliminar';
    v_cambios := jsonb_build_object('nombre', old.nombre, 'slug', old.slug, 'estado', old.estado);
  else
    v_id := new.id;
    v_cuenta := new.cuenta_id;
    v_nombre := new.nombre;
    if new.estado = 'publicada' and new.publicada_en is distinct from old.publicada_en then
      v_accion := 'publicar';
    elsif new.estado = 'borrador' and old.estado = 'publicada' then
      v_accion := 'despublicar';
    elsif new.nombre is distinct from old.nombre or new.slug is distinct from old.slug then
      v_accion := 'editar';
      select jsonb_object_agg(k, jsonb_build_object('antes', a, 'despues', d))
        into v_cambios
        from (values ('nombre', to_jsonb(old.nombre), to_jsonb(new.nombre)),
                     ('slug', to_jsonb(old.slug), to_jsonb(new.slug))) as c(k, a, d)
       where a is distinct from d;
    else
      return null;
    end if;
  end if;

  insert into public.auditoria (cuenta_id, usuario_id, entidad, registro_id, accion, descripcion, cambios)
  values (v_cuenta, (select auth.uid()), 'landings', v_id::text, v_accion, v_nombre, v_cambios);
  return null;
end;
$$;

-- Los permisos no cambian: create or replace los conserva; se repiten por claridad
grant execute on function public.landing_publica(text) to anon, authenticated;
grant execute on function public.landing_recibir(jsonb) to anon, authenticated;
grant execute on function public.landing_productos(text) to anon, authenticated;
grant execute on function public.landing_pedido(jsonb) to anon, authenticated;
