-- ============================================================================
-- Módulo «Carga masiva» (importacion): subir clientes/prospectos desde un CSV
-- ============================================================================
-- Forma parte del plan de la cuenta (Esencial en adelante) y el administrador lo
-- cede por usuario. Los administradores lo heredan como el resto de los módulos.
-- Requiere Clientes: las altas pasan por las mismas políticas de clientes, así que
-- el módulo habilita la pantalla de carga, no otorga permisos nuevos sobre los datos.

alter table public.cuentas drop constraint cuentas_modulos_validos;
alter table public.cuentas add constraint cuentas_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'importacion', 'oportunidades', 'pedidos', 'actividades',
    'productos', 'ventas', 'landings', 'etiquetas', 'auditoria',
    'asistente', 'asistente_altas'
  ]::text[]
);

alter table public.usuarios drop constraint usuarios_modulos_validos;
alter table public.usuarios add constraint usuarios_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'importacion', 'oportunidades', 'pedidos', 'actividades',
    'productos', 'ventas', 'landings', 'etiquetas', 'auditoria',
    'asistente', 'asistente_altas'
  ]::text[]
);

-- Las cuentas nuevas lo llevan por defecto (el asistente, no: es un extra)
alter table public.cuentas alter column modulos
  set default '{panel,clientes,importacion,oportunidades,pedidos,actividades,productos,ventas,landings,etiquetas,auditoria}';

-- Cuentas existentes con Clientes: pasan a incluirlo
update public.cuentas
set modulos = modulos || array['importacion']::text[]
where modulos @> array['clientes']::text[] and not (modulos @> array['importacion']::text[]);

-- Administradores: su lista incluye todo el plan (lo que hace la Edge Function users)
alter table public.usuarios disable trigger user;
update public.usuarios
set modulos = modulos || array['importacion']::text[]
where rol = 'administrador' and not sistema
  and modulos @> array['clientes']::text[] and not (modulos @> array['importacion']::text[]);
alter table public.usuarios enable trigger user;
