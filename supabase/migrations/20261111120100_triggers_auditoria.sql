-- Mini-CRM · triggers: sellos de autoría, reglas de negocio y registro de auditoría.
-- Los triggers BEFORE se ejecutan en orden alfabético: el prefijo numérico fija la secuencia.

-- ----------------------------------------------------------------------------
-- Sello de autoría: quién creó / modificó y cuándo (no se puede falsificar desde el cliente)
-- ----------------------------------------------------------------------------
create function public.sellar_autoria()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(uid, new.creado_por);
    new.creado_en := now();
    new.actualizado_por := coalesce(uid, new.creado_por);
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    new.actualizado_por := coalesce(uid, old.actualizado_por);
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Clientes: solo un administrador asigna / reasigna. Un vendedor que da de alta
-- un cliente queda como su responsable.
-- ----------------------------------------------------------------------------
create function public.clientes_asignacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  -- Sin sesión (servicio / migraciones) no se restringe
  if uid is null or (select public.es_administrador()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.asignado_a is not null and new.asignado_a <> uid then
      raise exception 'Solo un administrador puede asignar clientes a otro usuario'
        using errcode = '42501';
    end if;
    new.asignado_a := uid;
  elsif new.asignado_a is distinct from old.asignado_a then
    raise exception 'Solo un administrador puede reasignar clientes'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Oportunidades y actividades: responsable por defecto = quien las crea
create function public.asignar_por_defecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.asignado_a := coalesce(new.asignado_a, (select auth.uid()));
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Oportunidades: coherencia entre resultado, probabilidad y fechas de cierre
-- ----------------------------------------------------------------------------
create function public.oportunidades_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.resultado = 'ganada' then
    new.probabilidad := 100;
    new.motivo_perdida := null;
    new.fecha_cierre := coalesce(new.fecha_cierre, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  elsif new.resultado = 'perdida' then
    new.probabilidad := 0;
    new.fecha_cierre := coalesce(new.fecha_cierre, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  else
    new.fecha_cierre := null;
    new.motivo_perdida := null;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Actividades: las notas nacen realizadas; completada_en acompaña a completada
-- ----------------------------------------------------------------------------
create function public.actividades_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'nota' then
    new.completada := true;
  end if;
  if new.completada then
    new.completada_en := coalesce(new.completada_en, now());
  else
    new.completada_en := null;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Usuarios: sello de fecha y salvaguarda del último administrador activo
-- ----------------------------------------------------------------------------
create function public.usuarios_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quedaria_sin_admin boolean;
begin
  quedaria_sin_admin := old.rol = 'administrador' and old.activo
    and not exists (
      select 1 from public.usuarios u
      where u.id <> old.id and u.rol = 'administrador' and u.activo
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

create trigger trg_10_usuarios_proteger
  before update or delete on public.usuarios
  for each row execute function public.usuarios_proteger();

create trigger trg_10_clientes_asignacion
  before insert or update on public.clientes
  for each row execute function public.clientes_asignacion();
create trigger trg_20_clientes_autoria
  before insert or update on public.clientes
  for each row execute function public.sellar_autoria();

create trigger trg_10_oportunidades_asignar
  before insert on public.oportunidades
  for each row execute function public.asignar_por_defecto();
create trigger trg_20_oportunidades_normalizar
  before insert or update on public.oportunidades
  for each row execute function public.oportunidades_normalizar();
create trigger trg_30_oportunidades_autoria
  before insert or update on public.oportunidades
  for each row execute function public.sellar_autoria();

create trigger trg_10_actividades_asignar
  before insert on public.actividades
  for each row execute function public.asignar_por_defecto();
create trigger trg_20_actividades_normalizar
  before insert or update on public.actividades
  for each row execute function public.actividades_normalizar();
create trigger trg_30_actividades_autoria
  before insert or update on public.actividades
  for each row execute function public.sellar_autoria();

-- ----------------------------------------------------------------------------
-- Auditoría automática (AFTER, SECURITY DEFINER: escribe aunque el usuario no pueda)
-- ----------------------------------------------------------------------------
create function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  fila jsonb;
  antes jsonb;
  despues jsonb;
  diferencias jsonb;
  v_accion text;
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

  insert into public.auditoria (usuario_id, entidad, registro_id, cliente_id, accion, descripcion, cambios)
  values (
    (select auth.uid()),
    tg_table_name,
    fila ->> 'id',
    case when tg_table_name = 'clientes' then (fila ->> 'id')::bigint else (fila ->> 'cliente_id')::bigint end,
    v_accion,
    coalesce(fila ->> 'nombre_completo', fila ->> 'producto_servicio', fila ->> 'titulo'),
    diferencias
  );
  return null;
end;
$$;

create trigger trg_90_clientes_auditoria
  after insert or update or delete on public.clientes
  for each row execute function public.registrar_auditoria();
create trigger trg_90_oportunidades_auditoria
  after insert or update or delete on public.oportunidades
  for each row execute function public.registrar_auditoria();
create trigger trg_90_actividades_auditoria
  after insert or update or delete on public.actividades
  for each row execute function public.registrar_auditoria();
