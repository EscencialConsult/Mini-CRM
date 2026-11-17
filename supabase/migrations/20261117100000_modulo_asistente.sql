-- ============================================================================
-- Asistente de IA como módulo administrable
-- ============================================================================
-- Antes era solo de los administradores y no se podía ceder. Ahora es parte del
-- plan de cada cuenta (la plataforma lo contrata) y el administrador de la
-- cuenta decide quién lo usa y qué puede hacer con él:
--   asistente         consultar clientes, oportunidades y productos
--   asistente_altas   además, proponer y registrar prospectos (requiere asistente)
-- Las cuentas que ya existen lo conservan completo, como lo tenían.

alter table public.cuentas drop constraint cuentas_modulos_validos;
alter table public.cuentas add constraint cuentas_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'oportunidades', 'pedidos', 'actividades',
    'productos', 'ventas', 'landings', 'etiquetas', 'auditoria',
    'asistente', 'asistente_altas'
  ]::text[]
);

alter table public.usuarios drop constraint usuarios_modulos_validos;
alter table public.usuarios add constraint usuarios_modulos_validos check (
  modulos <@ array[
    'panel', 'clientes', 'oportunidades', 'pedidos', 'actividades',
    'productos', 'ventas', 'landings', 'etiquetas', 'auditoria',
    'asistente', 'asistente_altas'
  ]::text[]
);

-- Cuentas existentes: el plan suma el asistente completo
update public.cuentas
set modulos = modulos || array['asistente', 'asistente_altas']::text[]
where not (modulos @> array['asistente']::text[]);

-- Administradores: su lista de módulos incluye todo el plan (lo que hace la Edge Function users)
alter table public.usuarios disable trigger user;
update public.usuarios
set modulos = modulos || array['asistente', 'asistente_altas']::text[]
where rol = 'administrador' and not sistema and not (modulos @> array['asistente']::text[]);
alter table public.usuarios enable trigger user;
