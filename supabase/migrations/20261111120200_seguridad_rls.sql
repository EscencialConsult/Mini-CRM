-- Mini-CRM · seguridad: RLS y permisos. Sin sesión (anon) no se accede a nada.
--
-- Reglas de negocio:
--  · Administrador y vendedor activos ven y editan clientes, oportunidades y actividades.
--  · Solo el administrador elimina clientes y oportunidades (borrado definitivo).
--  · Una actividad la elimina su autor o un administrador.
--  · Solo el administrador reasigna clientes (trigger clientes_asignacion).
--  · Usuarios (rol / activo / alta) se gestionan por la Edge Function `users`;
--    cada usuario puede editar su propio nombre y apellido.
--  · La auditoría es de solo lectura y solo para administradores.

alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.oportunidades enable row level security;
alter table public.actividades enable row level security;
alter table public.auditoria enable row level security;

-- Usuarios
create policy usuarios_select on public.usuarios
  for select to authenticated
  using ((select public.usuario_activo()) or id = (select auth.uid()));

create policy usuarios_update_propio on public.usuarios
  for update to authenticated
  using (id = (select auth.uid()) and activo)
  with check (id = (select auth.uid()));

-- Clientes
create policy clientes_select on public.clientes
  for select to authenticated using ((select public.usuario_activo()));
create policy clientes_insert on public.clientes
  for insert to authenticated with check ((select public.usuario_activo()));
create policy clientes_update on public.clientes
  for update to authenticated
  using ((select public.usuario_activo())) with check ((select public.usuario_activo()));
create policy clientes_delete on public.clientes
  for delete to authenticated using ((select public.es_administrador()));

-- Oportunidades
create policy oportunidades_select on public.oportunidades
  for select to authenticated using ((select public.usuario_activo()));
create policy oportunidades_insert on public.oportunidades
  for insert to authenticated with check ((select public.usuario_activo()));
create policy oportunidades_update on public.oportunidades
  for update to authenticated
  using ((select public.usuario_activo())) with check ((select public.usuario_activo()));
create policy oportunidades_delete on public.oportunidades
  for delete to authenticated using ((select public.es_administrador()));

-- Actividades
create policy actividades_select on public.actividades
  for select to authenticated using ((select public.usuario_activo()));
create policy actividades_insert on public.actividades
  for insert to authenticated with check ((select public.usuario_activo()));
create policy actividades_update on public.actividades
  for update to authenticated
  using ((select public.usuario_activo())) with check ((select public.usuario_activo()));
create policy actividades_delete on public.actividades
  for delete to authenticated
  using (
    (select public.usuario_activo())
    and (creado_por = (select auth.uid()) or (select public.es_administrador()))
  );

-- Auditoría
create policy auditoria_select on public.auditoria
  for select to authenticated using ((select public.es_administrador()));

-- ============================================================================
-- Permisos de tabla (privilegio mínimo)
-- ============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

grant select on public.usuarios to authenticated;
grant update (nombre, apellido) on public.usuarios to authenticated;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.oportunidades to authenticated;
grant select, insert, update, delete on public.actividades to authenticated;
grant select on public.auditoria to authenticated;

-- Las políticas y los triggers llaman a estos helpers con el rol del usuario
grant execute on function public.usuario_activo() to authenticated;
grant execute on function public.es_administrador() to authenticated;
