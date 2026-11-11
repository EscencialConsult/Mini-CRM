-- Mini-CRM · etiquetas de prueba: el catálogo y su reparto entre los clientes ficticios,
-- más las etiquetas que suman las landings de ejemplo.
--
-- Requisitos: datos_prueba.sql ya cargado.
-- Uso: npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/seed/etiquetas_prueba.sql
--
-- Las etiquetas se crean como Carla (administradora), así quedan con su autoría. El reparto
-- entre clientes va sin triggers (session_replication_role = replica) para no tocar sus fechas
-- ni llenar la auditoría con ediciones que nadie hizo.

begin;

do $$
begin
  if exists (select 1 from public.etiquetas) then
    raise exception 'Ya hay etiquetas cargadas';
  end if;
  if not exists (select 1 from public.landings where slug = 'diplomatura-rrhh') then
    raise exception 'Faltan los datos de prueba (datos_prueba.sql)';
  end if;
end $$;

select setseed(0.1111);

select set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, true)
  from public.usuarios where email = 'carla.dominguez@example.com';

insert into public.etiquetas (nombre, color) values
  ('Diplomatura RRHH', 'violeta'),
  ('Selección de personal', 'azul'),
  ('Consultoría pymes', 'turquesa'),
  ('VIP', 'ambar'),
  ('Referido', 'verde'),
  ('Seguimiento urgente', 'rojo'),
  ('Evento 2026', 'rosa');

update public.etiquetas e set creado_en = now() - interval '45 days' + (e.id % 7) * interval '1 day';

select set_config('request.jwt.claims', '', true);
set local session_replication_role = replica;

create temp table reparto (cliente_id bigint, etiqueta text, orden int);

insert into reparto
select c.id, 'Diplomatura RRHH', 1 from public.clientes c
  join public.landings l on l.id = c.landing_id where l.slug = 'diplomatura-rrhh';
insert into reparto
select c.id, 'Selección de personal', 1 from public.clientes c
  join public.landings l on l.id = c.landing_id where l.slug = 'seleccion-personal';
insert into reparto
select id, 'Consultoría pymes', 2 from public.clientes where tipo = 'empresa' and random() < 0.45;
insert into reparto
select id, 'VIP', 3 from public.clientes where random() < 0.1;
insert into reparto
select id, 'Referido', 4 from public.clientes where landing_id is null and random() < 0.2;
insert into reparto
select id, 'Seguimiento urgente', 5 from public.clientes
 where estado = 'activo' and proximo_contacto < current_date and random() < 0.5;
insert into reparto
select id, 'Evento 2026', 6 from public.clientes where random() < 0.08;

update public.clientes c
   set etiquetas = r.ids
  from (
    select r.cliente_id, array_agg(e.id order by r.orden, e.id) as ids
      from reparto r join public.etiquetas e on e.nombre = r.etiqueta
     group by r.cliente_id
  ) r
 where r.cliente_id = c.id;

-- Las landings publicadas suman su etiqueta a cada cliente que llega
update public.landings l
   set borrador = jsonb_set(l.borrador, '{automation,tagIds}', to_jsonb(array[e.id])),
       publicada = case when l.publicada is null then null
                        else jsonb_set(l.publicada, '{automation,tagIds}', to_jsonb(array[e.id])) end
  from public.etiquetas e
 where (l.slug, e.nombre) in (('diplomatura-rrhh', 'Diplomatura RRHH'),
                              ('seleccion-personal', 'Selección de personal'),
                              ('consultoria-pymes', 'Consultoría pymes'));

commit;
