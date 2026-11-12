-- Módulos por usuario: el administrador decide qué partes del CRM usa cada
-- vendedor. Sin el módulo no aparece en el menú, la ruta no abre y la base
-- rechaza leer o escribir sus datos. El administrador tiene todos.
--
-- Referencias: quien tiene Tablero o Tareas lee clientes (nombre, selector),
-- pero solo quien tiene Clientes los crea o edita. El Panel no tiene datos
-- propios: sus funciones corren con los permisos de quien consulta, así que
-- solo suman lo que las políticas de abajo le dejan leer.

-- ----------------------------------------------------------------------------
-- Columna. Se cambia solo desde la Edge Function `users` (el permiso de columna
-- del cliente sigue limitado a nombre y apellido)
-- ----------------------------------------------------------------------------
alter table public.usuarios
  add column modulos text[] not null default '{panel,clientes,oportunidades,actividades}';

alter table public.usuarios add constraint usuarios_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'oportunidades', 'actividades', 'landings', 'etiquetas', 'auditoria'
  ]::text[]
);

-- Cada uno conserva lo que usaba: el vendedor, todo menos las pantallas de
-- administración; el administrador, todo (por si un día deja de serlo)
alter table public.usuarios disable trigger user;
update public.usuarios
set modulos = case
  when rol = 'administrador'
    then '{panel,clientes,oportunidades,actividades,landings,etiquetas,auditoria}'::text[]
  else '{panel,clientes,oportunidades,actividades,landings}'::text[]
end;
alter table public.usuarios enable trigger user;

-- ----------------------------------------------------------------------------
-- ¿El usuario que consulta tiene alguno de estos módulos? SECURITY DEFINER por
-- lo mismo que es_administrador(): no recursar en las políticas de `usuarios`
-- ----------------------------------------------------------------------------
create function public.tiene_modulo(variadic p_modulos text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())
      and u.activo
      and (u.rol = 'administrador' or u.modulos && p_modulos)
  );
$$;

grant execute on function public.tiene_modulo(text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Clientes: los leen también Tablero y Tareas; los escribe solo Clientes
-- ----------------------------------------------------------------------------
drop policy clientes_select on public.clientes;
drop policy clientes_insert on public.clientes;
drop policy clientes_update on public.clientes;

create policy clientes_select on public.clientes
  for select to authenticated
  using ((select public.tiene_modulo('clientes', 'oportunidades', 'actividades')));
create policy clientes_insert on public.clientes
  for insert to authenticated with check ((select public.tiene_modulo('clientes')));
create policy clientes_update on public.clientes
  for update to authenticated
  using ((select public.tiene_modulo('clientes'))) with check ((select public.tiene_modulo('clientes')));

-- ----------------------------------------------------------------------------
-- Oportunidades (Tablero)
-- ----------------------------------------------------------------------------
drop policy oportunidades_select on public.oportunidades;
drop policy oportunidades_insert on public.oportunidades;
drop policy oportunidades_update on public.oportunidades;

create policy oportunidades_select on public.oportunidades
  for select to authenticated using ((select public.tiene_modulo('oportunidades')));
create policy oportunidades_insert on public.oportunidades
  for insert to authenticated with check ((select public.tiene_modulo('oportunidades')));
create policy oportunidades_update on public.oportunidades
  for update to authenticated
  using ((select public.tiene_modulo('oportunidades')))
  with check ((select public.tiene_modulo('oportunidades')));

-- ----------------------------------------------------------------------------
-- Actividades (Tareas). Borrar: su autor o un administrador, como antes
-- ----------------------------------------------------------------------------
drop policy actividades_select on public.actividades;
drop policy actividades_insert on public.actividades;
drop policy actividades_update on public.actividades;
drop policy actividades_delete on public.actividades;

create policy actividades_select on public.actividades
  for select to authenticated using ((select public.tiene_modulo('actividades')));
create policy actividades_insert on public.actividades
  for insert to authenticated with check ((select public.tiene_modulo('actividades')));
create policy actividades_update on public.actividades
  for update to authenticated
  using ((select public.tiene_modulo('actividades')))
  with check ((select public.tiene_modulo('actividades')));
create policy actividades_delete on public.actividades
  for delete to authenticated
  using (
    (select public.tiene_modulo('actividades'))
    and (creado_por = (select auth.uid()) or (select public.es_administrador()))
  );

-- ----------------------------------------------------------------------------
-- Auditoría
-- ----------------------------------------------------------------------------
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria
  for select to authenticated using ((select public.tiene_modulo('auditoria')));

-- ----------------------------------------------------------------------------
-- Etiquetas: las usa quien tiene Clientes (las crea desde la ficha); el
-- catálogo (renombrar, recolorear, borrar) es del módulo Etiquetas
-- ----------------------------------------------------------------------------
drop policy etiquetas_select on public.etiquetas;
drop policy etiquetas_insert on public.etiquetas;
drop policy etiquetas_update on public.etiquetas;
drop policy etiquetas_delete on public.etiquetas;

create policy etiquetas_select on public.etiquetas
  for select to authenticated using ((select public.tiene_modulo('clientes', 'etiquetas')));
create policy etiquetas_insert on public.etiquetas
  for insert to authenticated with check ((select public.tiene_modulo('clientes', 'etiquetas')));
create policy etiquetas_update on public.etiquetas
  for update to authenticated
  using ((select public.tiene_modulo('etiquetas'))) with check ((select public.tiene_modulo('etiquetas')));
create policy etiquetas_delete on public.etiquetas
  for delete to authenticated using ((select public.tiene_modulo('etiquetas')));

-- ----------------------------------------------------------------------------
-- Landings. Eliminar sigue siendo del administrador y nunca una publicada
-- ----------------------------------------------------------------------------
drop policy landings_select on public.landings;
drop policy landings_insert on public.landings;
drop policy landings_update on public.landings;
drop policy landing_envios_select on public.landing_envios;
drop policy landing_visitas_select on public.landing_visitas;

create policy landings_select on public.landings
  for select to authenticated using ((select public.tiene_modulo('landings')));
create policy landings_insert on public.landings
  for insert to authenticated with check ((select public.tiene_modulo('landings')));
create policy landings_update on public.landings
  for update to authenticated
  using ((select public.tiene_modulo('landings'))) with check ((select public.tiene_modulo('landings')));
create policy landing_envios_select on public.landing_envios
  for select to authenticated using ((select public.tiene_modulo('landings')));
create policy landing_visitas_select on public.landing_visitas
  for select to authenticated using ((select public.tiene_modulo('landings')));

drop policy landing_imagenes_select on storage.objects;
drop policy landing_imagenes_insert on storage.objects;
drop policy landing_imagenes_delete on storage.objects;

create policy landing_imagenes_select on storage.objects
  for select to authenticated
  using (bucket_id = 'landing-imagenes' and (select public.tiene_modulo('landings')));
create policy landing_imagenes_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'landing-imagenes' and (select public.tiene_modulo('landings')));
create policy landing_imagenes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'landing-imagenes' and (select public.tiene_modulo('landings')));

-- Publicar y despublicar corren como SECURITY DEFINER: verifican el módulo ellas mismas
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
   where id = p_id
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
  update public.landings set estado = 'borrador' where id = p_id
  returning * into v_landing;
  if not found then
    raise exception 'La landing no existe' using errcode = 'P0002';
  end if;
  return v_landing;
end;
$$;
