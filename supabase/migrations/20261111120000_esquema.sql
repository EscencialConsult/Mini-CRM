-- Mini-CRM · esquema inicial: usuarios, clientes, oportunidades, actividades y auditoría.
-- Zona horaria de negocio: America/Argentina/Buenos_Aires (se usa en las funciones del panel).

-- ============================================================================
-- Usuarios (perfil del CRM, 1 a 1 con auth.users)
-- ============================================================================
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  apellido text not null check (btrim(apellido) <> ''),
  email text not null,
  rol text not null default 'vendedor' check (rol in ('administrador', 'vendedor')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index usuarios_email_key on public.usuarios (lower(email));

-- Helpers de permisos. SECURITY DEFINER para no recursar en las políticas de `usuarios`.
create function public.usuario_activo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.activo
  );
$$;

create function public.es_administrador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.activo and u.rol = 'administrador'
  );
$$;

-- ============================================================================
-- Clientes
-- ============================================================================
create table public.clientes (
  id bigint generated always as identity primary key,
  tipo text not null default 'persona' check (tipo in ('persona', 'empresa')),
  nombre text,
  apellido text,
  razon_social text,
  nombre_completo text generated always as (
    case
      when tipo = 'empresa' then coalesce(btrim(razon_social), '')
      else btrim(coalesce(apellido, '') || ' ' || coalesce(nombre, ''))
    end
  ) stored,
  -- Solo dígitos: DNI (7-8) o CUIT/CUIL (11)
  documento text,
  telefono text,
  email text,
  direccion text,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  proximo_contacto date,
  asignado_a uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  actualizado_por uuid references public.usuarios (id) on delete set null,
  constraint clientes_identidad check (
    (tipo = 'empresa' and nullif(btrim(razon_social), '') is not null)
    or (
      tipo = 'persona'
      and nullif(btrim(nombre), '') is not null
      and nullif(btrim(apellido), '') is not null
    )
  ),
  constraint clientes_documento check (documento is null or documento ~ '^([0-9]{7,8}|[0-9]{11})$')
);

create unique index clientes_documento_key on public.clientes (documento) where documento is not null;
create index clientes_asignado_a_idx on public.clientes (asignado_a);
create index clientes_estado_idx on public.clientes (estado);
create index clientes_creado_en_idx on public.clientes (creado_en desc);
create index clientes_proximo_contacto_idx on public.clientes (proximo_contacto) where proximo_contacto is not null;

-- ============================================================================
-- Oportunidades
-- ============================================================================
create table public.oportunidades (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  producto_servicio text not null check (btrim(producto_servicio) <> ''),
  descripcion text,
  importe_estimado numeric(14, 2) not null default 0 check (importe_estimado >= 0),
  etapa text not null default 'prospecto'
    check (etapa in ('prospecto', 'calificado', 'propuesta', 'negociacion')),
  probabilidad smallint not null default 10 check (probabilidad between 0 and 100),
  resultado text not null default 'abierta' check (resultado in ('abierta', 'ganada', 'perdida')),
  fecha_cierre_estimada date,
  fecha_cierre date,
  motivo_perdida text,
  asignado_a uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  actualizado_por uuid references public.usuarios (id) on delete set null,
  constraint oportunidades_cierre check ((resultado = 'abierta') = (fecha_cierre is null)),
  -- Permite que una actividad apunte a una oportunidad del mismo cliente
  constraint oportunidades_id_cliente_key unique (id, cliente_id)
);

create index oportunidades_cliente_idx on public.oportunidades (cliente_id);
create index oportunidades_asignado_a_idx on public.oportunidades (asignado_a);
create index oportunidades_resultado_etapa_idx on public.oportunidades (resultado, etapa);
create index oportunidades_fecha_cierre_idx on public.oportunidades (fecha_cierre) where fecha_cierre is not null;

-- ============================================================================
-- Actividades: llamadas, reuniones, notas y tareas
-- `fecha` es cuándo ocurrió (completada) o cuándo está programada / vence (pendiente).
-- ============================================================================
create table public.actividades (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('llamada', 'reunion', 'nota', 'tarea')),
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  oportunidad_id bigint,
  titulo text not null check (btrim(titulo) <> ''),
  descripcion text,
  fecha timestamptz not null default now(),
  completada boolean not null default false,
  completada_en timestamptz,
  asignado_a uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por uuid references public.usuarios (id) on delete set null,
  actualizado_por uuid references public.usuarios (id) on delete set null,
  constraint actividades_oportunidad_del_cliente
    foreign key (oportunidad_id, cliente_id)
    references public.oportunidades (id, cliente_id)
    on delete set null (oportunidad_id)
);

create index actividades_cliente_idx on public.actividades (cliente_id);
create index actividades_oportunidad_idx on public.actividades (oportunidad_id) where oportunidad_id is not null;
create index actividades_asignado_a_idx on public.actividades (asignado_a);
create index actividades_pendientes_idx on public.actividades (fecha) where not completada;

-- ============================================================================
-- Auditoría: quién hizo cada acción
-- ============================================================================
create table public.auditoria (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  usuario_id uuid references public.usuarios (id) on delete set null,
  entidad text not null check (entidad in ('clientes', 'oportunidades', 'actividades', 'usuarios')),
  registro_id text not null,
  cliente_id bigint,
  accion text not null check (accion in ('crear', 'editar', 'eliminar', 'activar', 'desactivar', 'cambiar_rol', 'restablecer_clave')),
  descripcion text,
  cambios jsonb
);

create index auditoria_fecha_idx on public.auditoria (fecha desc);
create index auditoria_entidad_idx on public.auditoria (entidad, registro_id);
create index auditoria_cliente_idx on public.auditoria (cliente_id) where cliente_id is not null;
create index auditoria_usuario_idx on public.auditoria (usuario_id);
