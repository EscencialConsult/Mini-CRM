-- Mini-CRM · datos de prueba: usuarios, clientes, oportunidades, actividades, landings
-- (visitas y envíos) y auditoría, con fechas repartidas en los últimos 8 meses.
--
-- Requisitos: las migraciones aplicadas y estos usuarios creados por la API de Auth:
--   npm run admin:crear -- carla.dominguez@example.com Carla Domínguez <clave> administrador
--   npm run admin:crear -- martin.pereyra@example.com Martín Pereyra <clave> vendedor
--   npm run admin:crear -- sofia.ramirez@example.com Sofía Ramírez <clave> vendedor
--   npm run admin:crear -- diego.fernandez@example.com Diego Fernández <clave> vendedor
--   npm run admin:crear -- lucia.benitez@example.com Lucía Benítez <clave> vendedor   (este script la deja inactiva)
-- Uso: npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/seed/datos_prueba.sql
--
-- Se ejecuta una sola vez: todo pasa por los triggers reales (autoría, reglas y auditoría) actuando
-- como cada usuario, y los envíos de las landings por landing_recibir. Al final se corren las fechas
-- hacia atrás (session_replication_role = replica) para que el panel y los resultados tengan historia.

begin;

do $$
begin
  if exists (select 1 from public.landings where slug in ('diplomatura-rrhh', 'seleccion-personal', 'consultoria-pymes')) then
    raise exception 'Los datos de prueba ya están cargados';
  end if;
end $$;

select setseed(0.2026);

create temp table inicio as select coalesce(max(id), 0) as auditoria_id from public.auditoria;
create temp table alta (tabla text, id bigint, creado timestamptz, primary key (tabla, id));
create temp table edicion (tabla text, id bigint, fecha timestamptz, primary key (tabla, id));
create temp table corrimiento (tabla text, id bigint, delta interval, primary key (tabla, id));
create temp table envio_cliente (cliente_id bigint primary key, fecha timestamptz);

-- Actuar como un usuario (null: un visitante anónimo)
create function pg_temp.como(p uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, true);
  perform set_config('crm.origen', '', true);
end $f$;

create function pg_temp.azar(a text[]) returns text language sql volatile as $f$
  select a[1 + floor(random() * array_length(a, 1))::int]
$f$;

create function pg_temp.entre(a timestamptz, b timestamptz) returns timestamptz language sql volatile as $f$
  select a + (b - a) * random()
$f$;

create function pg_temp.ascii(t text) returns text language sql immutable as $f$
  select regexp_replace(translate(lower(t), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9.]+', '', 'g')
$f$;

create function pg_temp.dni() returns text language plpgsql volatile as $f$
declare v text;
begin
  loop
    v := (18000000 + floor(random() * 27000000))::bigint::text;
    if not exists (select 1 from public.clientes where documento = v) then return v; end if;
  end loop;
end $f$;

-- CUIT/CUIL con dígito verificador válido
create function pg_temp.cuit(p_prefijo text) returns text language plpgsql volatile as $f$
declare
  base text;
  pesos int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  s int;
  d int;
begin
  loop
    base := p_prefijo || (10000000 + floor(random() * 89999999))::bigint::text;
    s := 0;
    for i in 1..10 loop s := s + substr(base, i, 1)::int * pesos[i]; end loop;
    d := 11 - (s % 11);
    if d = 11 then d := 0; end if;
    if d < 10 and not exists (select 1 from public.clientes where documento = base || d) then
      return base || d;
    end if;
  end loop;
end $f$;

create function pg_temp.telefono() returns text language plpgsql volatile as $f$
declare
  area text := pg_temp.azar(array['11', '11', '11', '351', '341', '261', '381', '223', '221', '299']);
  n int := 10 - length(area);
  num text := (4 + floor(random() * 3))::int::text || lpad(floor(random() * (10 ^ (n - 1)))::bigint::text, n - 1, '0');
begin
  return '+54 9 ' || area || ' ' || left(num, n - 4) || '-' || right(num, 4);
end $f$;

do $seed$
declare
  v_admin uuid;
  v_carla uuid;
  v_martin uuid;
  v_sofia uuid;
  v_diego uuid;
  v_lucia uuid;
  v_vendedores uuid[];
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_nombres text[] := array['Juan', 'María', 'Carlos', 'Ana', 'Jorge', 'Laura', 'Pablo', 'Florencia', 'Martín',
    'Lucía', 'Diego', 'Valeria', 'Sebastián', 'Carolina', 'Federico', 'Natalia', 'Gonzalo', 'Paula', 'Matías',
    'Romina', 'Nicolás', 'Agustina', 'Facundo', 'Camila', 'Hernán', 'Julieta', 'Ezequiel', 'Micaela', 'Leandro',
    'Soledad', 'Juan Pablo', 'María José'];
  v_apellidos text[] := array['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez',
    'García', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez',
    'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Gutiérrez', 'Pereyra', 'Molina', 'Castro', 'Ortiz', 'Silva'];
  v_empresas text[] := array['Logística del Sur SRL', 'Agro Pampa SA', 'Distribuidora Norte SA',
    'Metalúrgica Paraná SRL', 'Clínica San Martín SA', 'Estudio Contable Ruiz y Asociados', 'Software Austral SAS',
    'Constructora Andina SA', 'Alimentos del Litoral SA', 'Transportes Patagonia SRL', 'Textil Mendoza SA',
    'Farmacias del Centro SRL', 'Hotel Costa Atlántica SA', 'Seguros La Unión SA', 'Frigorífico El Ombú SA',
    'Inmobiliaria Plaza SRL', 'Laboratorio Biocruz SA', 'Muebles Quebracho SRL', 'Energía Renovable Cuyo SA',
    'Colegio San Agustín', 'Cooperativa Agrícola Unión', 'Veterinaria Los Álamos SRL', 'Panificadora La Espiga SA',
    'Autopartes Rafaela SRL'];
  v_calles text[] := array['Av. Corrientes', 'Av. Santa Fe', 'Av. Rivadavia', 'San Martín', 'Belgrano', 'Mitre',
    'Sarmiento', 'Av. Colón', 'Bv. Oroño', 'Av. San Juan', '9 de Julio', 'Córdoba', 'Tucumán', 'Av. del Libertador',
    'Las Heras'];
  v_ciudades text[] := array['CABA', 'CABA', 'CABA', 'Córdoba', 'Rosario', 'Mendoza', 'San Miguel de Tucumán',
    'Mar del Plata', 'La Plata', 'Neuquén', 'Salta', 'Santa Fe'];
  v_productos text[] := array['Diplomatura en RRHH', 'Selección de personal', 'Consultoría organizacional',
    'Capacitación en liderazgo', 'Evaluación de desempeño', 'Encuesta de clima laboral', 'Liquidación de sueldos',
    'Coaching ejecutivo', 'Assessment center', 'Capacitación in company'];
  v_desc_opp text[] := array['Para 15 personas del área comercial.', 'Búsqueda de dos analistas administrativos.',
    'Piden la propuesta en 3 etapas.', 'Quieren empezar el mes que viene.', 'Están comparando con otra consultora.',
    'Tienen el presupuesto anual aprobado.'];
  v_motivos text[] := array['Precio por encima de su presupuesto', 'Eligió a la competencia', 'Postergó la decisión',
    'Sin presupuesto este año', 'Dejó de responder'];
  v_tit_llamada text[] := array['Llamada de presentación', 'Seguimiento de la propuesta', 'Confirmar reunión',
    'Consulta por precios', 'Llamada para cerrar condiciones'];
  v_tit_reunion text[] := array['Reunión de relevamiento', 'Presentación de la propuesta', 'Reunión con el directorio',
    'Reunión de cierre', 'Visita a la planta'];
  v_tit_nota text[] := array['Pidió presupuesto para 20 personas', 'Prefiere que lo llamen por la tarde',
    'Decide el gerente general', 'Cambió el responsable de RRHH', 'Le interesa la modalidad en línea',
    'Volver a contactar después de las vacaciones'];
  v_tit_tarea text[] := array['Enviar propuesta', 'Preparar presupuesto', 'Enviar contrato para firma',
    'Llamar para seguimiento', 'Mandar el programa completo', 'Coordinar fecha de inicio'];
  v_desc_act text[] := array['Quedó en responder esta semana.', 'Pidió casos de éxito de su rubro.',
    'Le interesa empezar en marzo.', 'Hay que ajustar el precio por volumen.', 'Atendió la asistente; volver a llamar.',
    null, null];
  v_cargos text[] := array['Analista de RRHH', 'Jefa de Personal', 'Gerente general', 'Responsable de administración',
    'Coordinador de equipo', 'Estudiante'];
  v_puestos text[] := array['Vendedor/a', 'Analista contable', 'Jefe/a de planta', 'Recepcionista',
    'Desarrollador/a', 'Chofer'];
  v_mensajes text[] := array['Queremos ordenar el área de personas.', 'Necesitamos bajar la rotación.',
    '¿Trabajan con empresas del interior?'];
  v_utms jsonb[] := array['{"utm_source": "facebook", "utm_campaign": "inscripcion-noviembre"}',
    '{"utm_source": "instagram", "utm_campaign": "inscripcion-noviembre"}',
    '{"utm_source": "google", "utm_campaign": "busqueda-rrhh"}',
    '{"utm_source": "facebook", "utm_campaign": "remarketing"}',
    '{"utm_source": "email", "utm_campaign": "newsletter-octubre"}', '{}', '{}']::jsonb[];
  r record;
  i int;
  j int;
  n int;
  k_empresa int := 0;
  v_tipo text;
  v_nombre text;
  v_apellido text;
  v_razon text;
  v_doc text;
  v_email text;
  v_asignado uuid;
  v_actor uuid;
  v_alta timestamptz;
  v_estado text;
  v_cliente bigint;
  v_id bigint;
  v_opps bigint[];
  v_opp_alta timestamptz;
  v_res text;
  v_etapa text;
  v_act_tipo text;
  v_fecha timestamptz;
  v_act_alta timestamptz;
  v_completada boolean;
  v_usuario uuid;
  v_l1 bigint;
  v_l2 bigint;
  v_l3 bigint;
  v_landing bigint;
  v_slug text;
  v_contenido jsonb;
  v_t timestamptz;
  v_utm jsonb;
  v_existente text;
  v_datos jsonb;
  v_resp jsonb;
  v_campo jsonb;
  v_valor text;
  v_act_desde bigint;
  v_aud_desde bigint;
  v_envio record;
begin
  select id into v_admin from public.usuarios
   where rol = 'administrador' and activo and email not like '%@example.com' order by creado_en limit 1;
  select id into v_carla from public.usuarios where email = 'carla.dominguez@example.com';
  select id into v_martin from public.usuarios where email = 'martin.pereyra@example.com';
  select id into v_sofia from public.usuarios where email = 'sofia.ramirez@example.com';
  select id into v_diego from public.usuarios where email = 'diego.fernandez@example.com';
  select id into v_lucia from public.usuarios where email = 'lucia.benitez@example.com';
  if v_carla is null or v_martin is null or v_sofia is null or v_diego is null or v_lucia is null then
    raise exception 'Faltan los usuarios de prueba: ver el encabezado del archivo';
  end if;
  v_admin := coalesce(v_admin, v_carla);
  v_vendedores := array[v_martin, v_sofia, v_diego];

  -- ==========================================================================
  -- Clientes cargados a mano, con sus oportunidades y actividades
  -- ==========================================================================
  for i in 1..64 loop
    v_tipo := case when random() < 0.62 or k_empresa >= array_length(v_empresas, 1) then 'persona' else 'empresa' end;
    v_asignado := case
      when i % 17 = 0 then null
      when i % 9 = 0 then v_lucia
      when i % 7 = 0 then v_carla
      when i % 11 = 0 then v_admin
      else v_vendedores[1 + (i % 3)]
    end;
    -- Un vendedor da de alta sus propios clientes; el administrador asigna los demás
    v_actor := case when v_asignado = any(v_vendedores || v_lucia) and random() < 0.7 then v_asignado else v_admin end;
    v_alta := now() - (random() ^ 1.5) * interval '240 days' - interval '1 day';
    if v_tipo = 'persona' then
      v_nombre := pg_temp.azar(v_nombres);
      v_apellido := pg_temp.azar(v_apellidos);
      v_razon := null;
      v_doc := case
        when random() < 0.6 then pg_temp.dni()
        when random() < 0.4 then pg_temp.cuit(pg_temp.azar(array['20', '27']))
      end;
      v_email := case when random() < 0.85 then pg_temp.ascii(v_nombre || '.' || v_apellido) || i || '@example.com' end;
    else
      k_empresa := k_empresa + 1;
      v_nombre := null;
      v_apellido := null;
      v_razon := v_empresas[k_empresa];
      v_doc := case when random() < 0.85 then pg_temp.cuit('30') end;
      v_email := case when random() < 0.9 then 'contacto@' || replace(pg_temp.ascii(v_razon), '.', '') || '.example.com' end;
    end if;
    v_estado := case when random() < 0.1 then 'inactivo' else 'activo' end;

    perform pg_temp.como(v_actor);
    insert into public.clientes
      (tipo, nombre, apellido, razon_social, documento, telefono, email, direccion, estado, proximo_contacto, asignado_a)
    values (
      v_tipo, v_nombre, v_apellido, v_razon, v_doc,
      case when random() < 0.9 then pg_temp.telefono() end,
      v_email,
      case when random() < 0.75 then
        pg_temp.azar(v_calles) || ' ' || (100 + floor(random() * 4900))::int || ', ' || pg_temp.azar(v_ciudades)
      end,
      v_estado,
      case when v_estado = 'activo' and random() < 0.5 then v_hoy + (floor(random() * 32) - 10)::int end,
      v_asignado
    )
    returning id into v_cliente;
    insert into alta values ('clientes', v_cliente, v_alta);

    -- Lo que sigue lo hace el responsable del cliente (o el administrador si no tiene)
    v_actor := coalesce(v_asignado, v_admin);
    perform pg_temp.como(v_actor);

    v_opps := '{}';
    n := case when random() < 0.25 then 0 when random() < 0.55 then 1 when random() < 0.8 then 2 else 3 end;
    for j in 1..n loop
      v_opp_alta := pg_temp.entre(v_alta, v_alta + (now() - v_alta) * 0.7);
      v_res := case
        when v_opp_alta > now() - interval '10 days' then 'abierta'
        when random() < 0.32 then 'ganada'
        when random() < 0.3 then 'perdida'
        else 'abierta'
      end;
      v_etapa := case v_res
        when 'abierta' then pg_temp.azar(array['prospecto', 'calificado', 'propuesta', 'negociacion'])
        when 'ganada' then pg_temp.azar(array['negociacion', 'negociacion', 'propuesta'])
        else pg_temp.azar(array['prospecto', 'calificado', 'propuesta', 'negociacion'])
      end;
      insert into public.oportunidades
        (cliente_id, producto_servicio, descripcion, importe_estimado, etapa, probabilidad, resultado,
         fecha_cierre_estimada, fecha_cierre, motivo_perdida, asignado_a)
      values (
        v_cliente,
        pg_temp.azar(v_productos),
        case when random() < 0.6 then pg_temp.azar(v_desc_opp) end,
        round((150000 + (random() ^ 2) * 5850000) / 1000) * 1000,
        v_etapa,
        case v_etapa when 'prospecto' then 10 when 'calificado' then 25 when 'propuesta' then 50 else 75 end,
        v_res,
        case when v_res = 'abierta' then v_hoy + (floor(random() * 100) - 12)::int
             else ((v_opp_alta + interval '30 days') at time zone 'America/Argentina/Buenos_Aires')::date end,
        case when v_res <> 'abierta' then
          least(v_hoy, ((v_opp_alta + (5 + random() * 55) * interval '1 day') at time zone 'America/Argentina/Buenos_Aires')::date)
        end,
        case when v_res = 'perdida' then pg_temp.azar(v_motivos) end,
        v_actor
      )
      returning id into v_id;
      v_opps := v_opps || v_id;
      insert into alta values ('oportunidades', v_id, v_opp_alta);
    end loop;

    n := 1 + floor(random() * 5)::int;
    for j in 1..n loop
      v_act_tipo := pg_temp.azar(array['llamada', 'llamada', 'reunion', 'nota', 'nota', 'tarea', 'tarea']);
      v_completada := v_act_tipo = 'nota' or v_estado = 'inactivo' or random() < 0.65;
      if v_completada then
        v_fecha := pg_temp.entre(v_alta, now() - interval '1 hour');
        v_act_alta := v_fecha;
      else
        v_fecha := greatest(v_alta + interval '1 day', now() + (random() * 22 - 6) * interval '1 day');
        v_act_alta := greatest(v_alta, pg_temp.entre(v_alta, least(now(), v_fecha) - interval '1 hour'));
      end if;
      insert into public.actividades
        (tipo, cliente_id, oportunidad_id, titulo, descripcion, fecha, completada, completada_en, asignado_a)
      values (
        v_act_tipo,
        v_cliente,
        case when array_length(v_opps, 1) > 0 and random() < 0.45
          then v_opps[1 + floor(random() * array_length(v_opps, 1))::int] end,
        case v_act_tipo
          when 'llamada' then pg_temp.azar(v_tit_llamada)
          when 'reunion' then pg_temp.azar(v_tit_reunion)
          when 'nota' then pg_temp.azar(v_tit_nota)
          else pg_temp.azar(v_tit_tarea)
        end,
        pg_temp.azar(v_desc_act),
        v_fecha,
        v_completada,
        case when v_completada then v_fecha end,
        v_actor
      )
      returning id into v_id;
      insert into alta values ('actividades', v_id, v_act_alta);
    end loop;
  end loop;

  -- Avances de etapa y datos corregidos: dejan "Editó" en la auditoría
  for r in
    select o.id, o.etapa, o.asignado_a, a.creado
      from public.oportunidades o join alta a on a.tabla = 'oportunidades' and a.id = o.id
     where o.resultado = 'abierta' and o.etapa <> 'negociacion'
     order by random() limit 14
  loop
    perform pg_temp.como(r.asignado_a);
    update public.oportunidades
       set etapa = case r.etapa when 'prospecto' then 'calificado' when 'calificado' then 'propuesta' else 'negociacion' end,
           probabilidad = case r.etapa when 'prospecto' then 25 when 'calificado' then 50 else 75 end
     where id = r.id;
    insert into edicion values ('oportunidades', r.id, pg_temp.entre(r.creado, now() - interval '2 hours'));
  end loop;

  for r in
    select c.id, c.asignado_a, a.creado
      from public.clientes c join alta a on a.tabla = 'clientes' and a.id = c.id
     where c.estado = 'activo' order by random() limit 10
  loop
    perform pg_temp.como(coalesce(r.asignado_a, v_admin));
    update public.clientes set telefono = pg_temp.telefono() where id = r.id;
    insert into edicion values ('clientes', r.id, pg_temp.entre(r.creado, now() - interval '2 hours'));
  end loop;

  -- Recordatorios: cada usuario activo tiene algo vencido y algo para hoy
  foreach v_usuario in array array[v_admin, v_carla, v_martin, v_sofia, v_diego] loop
    v_cliente := null;
    select id into v_cliente from public.clientes
     where asignado_a = v_usuario and estado = 'activo' order by random() limit 1;
    if v_cliente is null then
      select id into v_cliente from public.clientes where estado = 'activo' order by random() limit 1;
    end if;
    perform pg_temp.como(v_usuario);
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignado_a)
    values ('tarea', v_cliente, 'Enviar la propuesta actualizada', now() - interval '3 days', v_usuario)
    returning id into v_id;
    insert into alta values ('actividades', v_id, now() - interval '9 days');
    insert into public.actividades (tipo, cliente_id, titulo, fecha, asignado_a)
    values ('llamada', v_cliente, 'Llamar para confirmar la reunión',
            (v_hoy + time '17:00') at time zone 'America/Argentina/Buenos_Aires', v_usuario)
    returning id into v_id;
    insert into alta values ('actividades', v_id, now() - interval '4 days');

    update public.clientes set proximo_contacto = v_hoy where id = v_cliente and asignado_a = v_usuario;
    if found then
      insert into edicion values ('clientes', v_cliente, now() - interval '3 days')
      on conflict (tabla, id) do update set fecha = excluded.fecha;
    end if;
    v_id := null;
    select id into v_id from public.clientes
     where asignado_a = v_usuario and estado = 'activo' and id <> v_cliente order by random() limit 1;
    if v_id is not null then
      update public.clientes set proximo_contacto = v_hoy - 4 where id = v_id;
      insert into edicion values ('clientes', v_id, now() - interval '6 days')
      on conflict (tabla, id) do update set fecha = excluded.fecha;
    end if;
  end loop;

  -- ==========================================================================
  -- Landings: dos publicadas (con visitas y envíos) y un borrador con pendientes
  -- ==========================================================================
  perform pg_temp.como(v_admin);
  insert into public.landings (nombre, slug, borrador)
  values ('Diplomatura en RRHH 2027', 'diplomatura-rrhh', $json${"version":1,"design":{"primaryColor":"#0f766e","background":{"type":"gradient","color":"#0f766e","color2":"#134e4a","imageUrl":"","overlay":50},"font":"jakarta","radius":"soft","formPosition":"side"},"hero":{"logoUrl":"","eyebrow":"Formación en Recursos Humanos","title":"Diplomatura en Gestión de Recursos Humanos","subtitle":"Para profesionales que quieren liderar procesos de personas con herramientas prácticas desde el primer día.","imageUrl":"","highlights":["En línea y en vivo","6 meses","Certificado universitario"],"ctaLabel":"Quiero información"},"sections":[{"id":"sfaabf408","type":"stats","enabled":false,"title":"","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"+1.200","subtitle":"egresados","text":""},{"title":"94 %","subtitle":"lo recomienda","text":""},{"title":"15 años","subtitle":"formando profesionales","text":""}]},{"id":"s6f2be054","type":"benefits","enabled":true,"title":"Qué vas a aprender","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Selección y entrevistas","subtitle":"","text":"Definir perfiles, evaluar candidatos y decidir con criterio."},{"title":"Gestión del desempeño","subtitle":"","text":"Fijar objetivos claros y dar devoluciones que ayuden a mejorar."},{"title":"Clima y cultura","subtitle":"","text":"Medir cómo está el equipo y actuar sobre lo que encuentres."}]},{"id":"sd8a4a475","type":"modules","enabled":true,"title":"Programa","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Selección por competencias","subtitle":"","text":"Perfiles, entrevistas y evaluación de candidatos."},{"title":"Desarrollo y desempeño","subtitle":"","text":"Indicadores, clima laboral y evaluación del desempeño."}]},{"id":"s8bbff9bf","type":"steps","enabled":true,"title":"Cómo funciona","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Déjanos tus datos","subtitle":"","text":"Completa el formulario en menos de un minuto."},{"title":"Te contactamos","subtitle":"","text":"Conversamos sobre lo que necesitas."},{"title":"Empiezas","subtitle":"","text":"Te contactamos para confirmar tu vacante y el medio de pago."}]},{"id":"sefc8b089","type":"testimonials","enabled":false,"title":"Lo que dicen quienes ya pasaron por aquí","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Valeria Ortiz","subtitle":"Analista de RRHH en Agro Pampa SA","text":"Apliqué lo aprendido desde la primera semana en mi trabajo."},{"title":"Gustavo Medina","subtitle":"Jefe de Personal en Logística del Sur SRL","text":"Muy práctica, con docentes que trabajan en el área."}]},{"id":"sc6b0d76d","type":"pricing","enabled":false,"title":"Inversión","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Pago en cuotas","subtitle":"6 cuotas de $85.000","text":"Clases en vivo y grabadas\nMaterial descargable y certificado"}]},{"id":"s7d2b26fc","type":"video","enabled":false,"title":"Míralo en un minuto","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[]},{"id":"se80ce57d","type":"about","enabled":true,"title":"Quiénes somos","text":"Somos una consultora de RRHH con 15 años acompañando a empresas y profesionales de todo el país.","imageUrl":"","videoUrl":"","ctaLabel":"","items":[]},{"id":"s93dcc000","type":"faq","enabled":true,"title":"Preguntas frecuentes","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"¿Cuánto dura y cómo se cursa?","subtitle":"","text":"Dura 6 meses, con dos clases en vivo por semana."},{"title":"¿Qué incluye?","subtitle":"","text":"Incluye clases grabadas, material descargable y el certificado."}]},{"id":"s93c48338","type":"cta","enabled":true,"title":"¿Te quedan dudas?","text":"Déjanos tus datos y te contamos todos los detalles.","imageUrl":"","videoUrl":"","ctaLabel":"","items":[]}],"footer":{"company":"Consultora Demo","email":"contacto@example.com","phone":"","address":""},"form":{"title":"Quiero más información","intro":"Déjanos tus datos y te contamos todos los detalles.","submitLabel":"Quiero información","fields":[{"id":"q3b6680c6","label":"Nombre y apellido","type":"text","target":"full_name","required":true,"options":[]},{"id":"q87e99143","label":"Email","type":"email","target":"email","required":true,"options":[]},{"id":"q3784b4fe","label":"Teléfono","type":"phone","target":"phone","required":false,"options":[]},{"id":"qf8017b00","label":"Empresa","type":"text","target":"company","required":false,"options":[]},{"id":"q70419335","label":"Cargo","type":"text","target":"title","required":false,"options":[]},{"id":"qf4c26a1c","label":"¿Cómo prefieres cursar?","type":"radio","target":"answer","required":false,"options":["En línea","Presencial","Todavía no lo sé"]}],"consent":{"enabled":true,"text":"Acepto recibir correos de Consultora Demo sobre esta propuesta. Puedo darme de baja cuando quiera."}},"thanks":{"mode":"message","title":"¡Gracias!","message":"Recibimos tus datos. Te contactaremos pronto.","url":""},"whatsapp":{"enabled":true,"phone":"+54 9 11 5555-0101","label":"Escríbenos","message":"Hola, soy {{nombre}} y quiero más información","popupTitle":"Hablemos por WhatsApp","popupText":"Déjanos tu nombre y número, y abrimos el chat."},"tracking":{"facebookPixelId":"","googleTagId":""},"automation":{"adminId":null,"taskTitle":"Contactar (interés en formación)","taskDueInDays":1},"seo":{"title":"","description":"","imageUrl":""},"privacy":{"title":"Política de privacidad","text":"Consultora Demo es responsable de los datos que nos dejas en esta página.\n\nQué datos guardamos: los que completas en el formulario y la fecha en que lo enviaste.\n\nPara qué los usamos: para responder tu consulta y enviarte información sobre lo que pediste.\n\nQuién los ve: solo nuestro equipo. No vendemos, alquilamos ni compartimos tus datos con otras empresas.\n\nCómo darte de baja: cada correo trae un enlace para dejar de recibirlos. También puedes pedir que corrijamos o borremos tus datos escribiendo a contacto@example.com.\n\nMás información: escribinos al correo de contacto."},"settings":{"channel":""}}$json$::jsonb)
  returning id into v_l1;
  perform public.landing_publicar(v_l1);

  perform pg_temp.como(v_carla);
  insert into public.landings (nombre, slug, borrador)
  values ('Búsquedas laborales para empresas', 'seleccion-personal',
          jsonb_set($json${"version":1,"design":{"primaryColor":"#1d4ed8","background":{"type":"gradient","color":"#1e40af","color2":"#172554","imageUrl":"","overlay":50},"font":"jakarta","radius":"soft","formPosition":"side"},"hero":{"logoUrl":"","eyebrow":"Selección de personal","title":"Encuentra a la persona indicada para tu equipo","subtitle":"Búsquedas operativas, técnicas y gerenciales, con una terna evaluada en 15 días hábiles.","imageUrl":"","highlights":["Definimos el perfil contigo","Filtramos y entrevistamos por ti","Te acompañamos en la decisión"],"ctaLabel":"Quiero que me contacten"},"sections":[{"id":"s6fa920b2","type":"stats","enabled":false,"title":"","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"+350","subtitle":"búsquedas cerradas","text":""},{"title":"15 días","subtitle":"para presentar la terna","text":""},{"title":"92 %","subtitle":"sigue en su puesto al año","text":""}]},{"id":"s54cd552d","type":"steps","enabled":true,"title":"Cómo trabajamos","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Entendemos lo que necesitas","subtitle":"","text":"Definimos juntos el perfil, las tareas y la cultura de tu empresa."},{"title":"Evaluamos a los candidatos","subtitle":"","text":"Filtramos y entrevistamos para que llegues solo a los que encajan."},{"title":"Te acompañamos en la decisión","subtitle":"","text":"Compartimos nuestra evaluación y seguimos cerca durante la incorporación."}]},{"id":"sfb0002f5","type":"testimonials","enabled":false,"title":"Lo que dicen quienes ya pasaron por aquí","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Ana Torres","subtitle":"Gerente de RRHH en Textil Mendoza SA","text":"Cubrimos tres puestos clave en menos de un mes."},{"title":"Ricardo Sosa","subtitle":"Director en Software Austral SAS","text":"La terna fue precisa: contratamos al primer candidato."}]},{"id":"s006e7a9c","type":"about","enabled":true,"title":"Quiénes somos","text":"Somos una consultora de RRHH con 15 años acompañando a empresas de todo el país.","imageUrl":"","videoUrl":"","ctaLabel":"","items":[]},{"id":"sea0d5de9","type":"faq","enabled":true,"title":"Preguntas frecuentes","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"¿Cuánto tarda una búsqueda?","subtitle":"","text":"Presentamos la terna en 15 días hábiles."},{"title":"¿Cómo se paga el servicio?","subtitle":"","text":"50 % al inicio y 50 % cuando ingresa el candidato."}]},{"id":"s96ffc081","type":"cta","enabled":true,"title":"¿Tienes una búsqueda abierta?","text":"Cuéntanos qué necesitas y te respondemos para conversarlo.","imageUrl":"","videoUrl":"","ctaLabel":"","items":[]}],"footer":{"company":"Consultora Demo","email":"contacto@example.com","phone":"","address":""},"form":{"title":"Cuéntanos qué buscas","intro":"Te respondemos para conversar sobre tu búsqueda.","submitLabel":"Quiero que me contacten","fields":[{"id":"q9c9d04a6","label":"Nombre y apellido","type":"text","target":"full_name","required":true,"options":[]},{"id":"qe7907571","label":"Email","type":"email","target":"email","required":true,"options":[]},{"id":"qb55bbd8b","label":"Teléfono","type":"phone","target":"phone","required":false,"options":[]},{"id":"q1c080d49","label":"Empresa","type":"text","target":"company","required":true,"options":[]},{"id":"qbcbaaea7","label":"Cargo","type":"text","target":"title","required":false,"options":[]},{"id":"q096b75b7","label":"¿Qué perfil buscas?","type":"text","target":"answer","required":true,"options":[]},{"id":"q391d82b5","label":"¿Cuántas personas necesitas?","type":"select","target":"answer","required":false,"options":["1","2 a 5","Más de 5"]}],"consent":{"enabled":true,"text":"Acepto recibir correos de Consultora Demo sobre esta propuesta. Puedo darme de baja cuando quiera."}},"thanks":{"mode":"message","title":"¡Gracias!","message":"Recibimos tus datos. Te contactaremos pronto.","url":""},"whatsapp":{"enabled":false,"phone":"","label":"Escríbenos","message":"Hola, soy {{nombre}} y quiero más información","popupTitle":"Hablemos por WhatsApp","popupText":"Déjanos tu nombre y número, y abrimos el chat."},"tracking":{"facebookPixelId":"","googleTagId":""},"automation":{"adminId":null,"taskTitle":"Contactar (interés en selección)","taskDueInDays":1},"seo":{"title":"","description":"","imageUrl":""},"privacy":{"title":"Política de privacidad","text":"Consultora Demo es responsable de los datos que nos dejas en esta página.\n\nQué datos guardamos: los que completas en el formulario y la fecha en que lo enviaste.\n\nPara qué los usamos: para responder tu consulta y enviarte información sobre lo que pediste.\n\nQuién los ve: solo nuestro equipo. No vendemos, alquilamos ni compartimos tus datos con otras empresas.\n\nCómo darte de baja: cada correo trae un enlace para dejar de recibirlos. También puedes pedir que corrijamos o borremos tus datos escribiendo a contacto@example.com.\n\nMás información: escribinos al correo de contacto."},"settings":{"channel":""}}$json$::jsonb, '{automation,adminId}', to_jsonb(v_carla::text)))
  returning id into v_l2;
  perform public.landing_publicar(v_l2);

  insert into public.landings (nombre, slug, borrador)
  values ('Consultoría para pymes', 'consultoria-pymes', $json${"version":1,"design":{"primaryColor":"#4338ca","background":{"type":"gradient","color":"#312e81","color2":"#1e1b4b","imageUrl":"","overlay":50},"font":"jakarta","radius":"soft","formPosition":"below"},"hero":{"logoUrl":"","eyebrow":"Consultoría de Recursos Humanos","title":"Ordena la gestión de personas de tu empresa","subtitle":"[COMPLETAR: qué problema resuelven y para qué empresas]","imageUrl":"","highlights":[],"ctaLabel":"Quiero conversar"},"sections":[{"id":"sb4dfd150","type":"benefits","enabled":true,"title":"En qué te ayudamos","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Diagnóstico","subtitle":"","text":"Revisamos cómo funciona hoy tu área de personas y qué conviene priorizar."},{"title":"Procesos claros","subtitle":"","text":"Ordenamos ingresos, evaluaciones y comunicación interna."},{"title":"Acompañamiento","subtitle":"","text":"Ayudamos a tu equipo a poner en marcha los cambios."}]},{"id":"sac55b031","type":"steps","enabled":true,"title":"Cómo funciona","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"Conversamos","subtitle":"","text":"Nos cuentas qué te preocupa y cómo está tu equipo."},{"title":"Diagnosticamos","subtitle":"","text":"[COMPLETAR: cómo hacen el diagnóstico]"},{"title":"Ponemos en marcha","subtitle":"","text":"[COMPLETAR: cómo acompañan los cambios]"}]},{"id":"s42cd4d89","type":"testimonials","enabled":false,"title":"Lo que dicen quienes ya pasaron por aquí","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"[COMPLETAR: nombre real]","subtitle":"[COMPLETAR: cargo y empresa]","text":"[COMPLETAR: testimonio real, con su permiso]"},{"title":"[COMPLETAR: nombre real]","subtitle":"[COMPLETAR: cargo y empresa]","text":"[COMPLETAR: testimonio real, con su permiso]"}]},{"id":"sf8c854d1","type":"about","enabled":true,"title":"Quiénes somos","text":"[COMPLETAR: quiénes son y por qué elegirlos]","imageUrl":"","videoUrl":"","ctaLabel":"","items":[]},{"id":"scfbdab26","type":"faq","enabled":true,"title":"Preguntas frecuentes","text":"","imageUrl":"","videoUrl":"","ctaLabel":"","items":[{"title":"¿Cómo empezamos?","subtitle":"","text":"[COMPLETAR: primer paso del trabajo]"},{"title":"¿Con qué tamaño de empresa trabajan?","subtitle":"","text":"[COMPLETAR: tipo de clientes]"}]}],"footer":{"company":"Consultora Demo","email":"contacto@example.com","phone":"","address":""},"form":{"title":"Conversemos sobre tu empresa","intro":"Cuéntanos brevemente qué necesitas.","submitLabel":"Quiero conversar","fields":[{"id":"qe0cc095b","label":"Nombre y apellido","type":"text","target":"full_name","required":true,"options":[]},{"id":"q9cf61e6b","label":"Email","type":"email","target":"email","required":true,"options":[]},{"id":"q4508f6c9","label":"Teléfono","type":"phone","target":"phone","required":false,"options":[]},{"id":"q234957b7","label":"Empresa","type":"text","target":"company","required":true,"options":[]},{"id":"qa959c472","label":"Cargo","type":"text","target":"title","required":false,"options":[]},{"id":"q818f08e5","label":"¿Cuántas personas trabajan?","type":"select","target":"answer","required":false,"options":["1 a 10","11 a 50","51 a 200","Más de 200"]},{"id":"qc59662b2","label":"¿Qué quieres resolver?","type":"textarea","target":"message","required":false,"options":[]}],"consent":{"enabled":true,"text":"Acepto recibir correos de Consultora Demo sobre esta propuesta. Puedo darme de baja cuando quiera."}},"thanks":{"mode":"message","title":"¡Gracias!","message":"Recibimos tus datos. Te contactaremos pronto.","url":""},"whatsapp":{"enabled":true,"phone":"","label":"Escríbenos","message":"Hola, soy {{nombre}} y quiero más información","popupTitle":"Hablemos por WhatsApp","popupText":"Déjanos tu nombre y número, y abrimos el chat."},"tracking":{"facebookPixelId":"","googleTagId":""},"automation":{"adminId":null,"taskTitle":"Contactar (interés en consultoría)","taskDueInDays":1},"seo":{"title":"","description":"","imageUrl":""},"privacy":{"title":"Política de privacidad","text":"Consultora Demo es responsable de los datos que nos dejas en esta página.\n\nQué datos guardamos: los que completas en el formulario y la fecha en que lo enviaste.\n\nPara qué los usamos: para responder tu consulta y enviarte información sobre lo que pediste.\n\nQuién los ve: solo nuestro equipo. No vendemos, alquilamos ni compartimos tus datos con otras empresas.\n\nCómo darte de baja: cada correo trae un enlace para dejar de recibirlos. También puedes pedir que corrijamos o borremos tus datos escribiendo a contacto@example.com.\n\nMás información: [COMPLETAR: revisa este texto según la ley de tu país]."},"settings":{"channel":""}}$json$::jsonb)
  returning id into v_l3;

  for j in 0..42 loop
    insert into public.landing_visitas (landing_id, dia, visitas) values
      (v_l1, v_hoy - j, greatest(3, round(45 + 25 * sin(j / 2.5) + random() * 35
        - case when extract(isodow from v_hoy - j) >= 6 then 20 else 0 end))::int),
      (v_l2, v_hoy - j, greatest(1, round(18 + 10 * sin(j / 3.0) + random() * 15
        - case when extract(isodow from v_hoy - j) >= 6 then 10 else 0 end))::int);
  end loop;

  -- Cada envío pasa por landing_recibir, como si lo mandara un visitante (IP ficticia propia)
  for i in 1..40 loop
    v_landing := case when i % 3 = 0 then v_l2 else v_l1 end;
    select slug, publicada into v_slug, v_contenido from public.landings where id = v_landing;
    v_t := now() - (random() ^ 1.2) * interval '41 days' - interval '30 minutes';
    v_utm := v_utms[1 + floor(random() * array_length(v_utms, 1))::int];
    v_nombre := pg_temp.azar(v_nombres);
    v_apellido := pg_temp.azar(v_apellidos);
    v_existente := null;
    if random() < 0.12 then
      select c.email into v_existente
        from public.clientes c join alta a on a.tabla = 'clientes' and a.id = c.id
       where c.email is not null and c.tipo = 'persona' and a.creado < v_t
       order by random() limit 1;
    end if;
    v_email := coalesce(v_existente, pg_temp.ascii(v_nombre || '.' || v_apellido) || i || '@example.org');

    if v_landing = v_l1 and v_existente is null and random() < 0.18 then
      v_datos := jsonb_build_object('slug', v_slug, 'kind', 'whatsapp',
        'name', v_nombre || case when random() < 0.5 then ' ' || v_apellido else '' end,
        'phone', pg_temp.telefono(), 'utm', v_utm, 'website', '');
    else
      v_resp := '{}';
      for v_campo in select * from jsonb_array_elements(v_contenido -> 'form' -> 'fields') loop
        v_valor := case
          when v_campo ->> 'target' = 'full_name' then v_nombre || ' ' || v_apellido
          when v_campo ->> 'target' = 'first_name' then v_nombre
          when v_campo ->> 'target' = 'last_name' then v_apellido
          when v_campo ->> 'target' = 'email' then v_email
          when v_campo ->> 'target' = 'phone' then
            case when coalesce((v_campo ->> 'required')::boolean, false) or random() < 0.7 then pg_temp.telefono() end
          when v_campo ->> 'target' = 'company' then
            case when coalesce((v_campo ->> 'required')::boolean, false) or random() < 0.5 then pg_temp.azar(v_empresas) end
          when v_campo ->> 'target' = 'title' then
            case when random() < 0.5 then pg_temp.azar(v_cargos) end
          when v_campo ->> 'type' in ('select', 'radio') then
            case when coalesce((v_campo ->> 'required')::boolean, false) or random() < 0.85
              then v_campo -> 'options' ->> floor(random() * jsonb_array_length(v_campo -> 'options'))::int end
          when v_campo ->> 'type' = 'textarea' then
            case when random() < 0.6 then pg_temp.azar(v_mensajes) end
          when v_campo ->> 'type' = 'checkbox' then null
          else case when coalesce((v_campo ->> 'required')::boolean, false) or random() < 0.6 then pg_temp.azar(v_puestos) end
        end;
        if v_valor is not null then
          v_resp := v_resp || jsonb_build_object(v_campo ->> 'id', v_valor);
        end if;
      end loop;
      v_datos := jsonb_build_object('slug', v_slug, 'answers', v_resp, 'consent', true, 'utm', v_utm, 'website', '');
    end if;

    select coalesce(max(id), 0) into v_act_desde from public.actividades;
    select coalesce(max(id), 0) into v_aud_desde from public.auditoria;
    perform pg_temp.como(null);
    perform set_config('request.headers', json_build_object('x-forwarded-for',
      '190.' || (10 + i) || '.' || floor(random() * 250)::int || '.' || floor(random() * 250)::int)::text, true);
    perform public.landing_recibir(v_datos);
    perform pg_temp.como(null);

    select id, cliente_id, cliente_nuevo into v_envio from public.landing_envios order by id desc limit 1;
    insert into corrimiento values ('landing_envios', v_envio.id, now() - v_t);
    if v_envio.cliente_nuevo then
      insert into corrimiento values ('clientes', v_envio.cliente_id, now() - v_t);
      insert into envio_cliente values (v_envio.cliente_id, v_t);
    end if;
    insert into corrimiento select 'actividades', id, now() - v_t from public.actividades where id > v_act_desde;
    insert into corrimiento select 'auditoria', id, now() - v_t from public.auditoria where id > v_aud_desde;
  end loop;
  perform set_config('request.headers', '{}', true);

  -- Las tareas de seguimiento que ya pasaron, en su mayoría, se hicieron
  for r in
    select a.id, a.asignado_a, a.fecha - k.delta as fecha_real
      from public.actividades a join corrimiento k on k.tabla = 'actividades' and k.id = a.id
     where a.tipo = 'tarea' and not a.completada
  loop
    if r.fecha_real < now() - interval '1 day' and random() < 0.75 then
      perform pg_temp.como(r.asignado_a);
      update public.actividades set completada = true where id = r.id;
      insert into edicion values ('actividades', r.id, least(r.fecha_real + interval '3 hours', now() - interval '1 hour'));
    end if;
  end loop;

  -- Ventas que vinieron de las landings
  j := 0;
  for r in
    select ec.cliente_id, ec.fecha, c.asignado_a, c.landing_id
      from envio_cliente ec join public.clientes c on c.id = ec.cliente_id
     where ec.fecha < now() - interval '8 days'
     order by ec.fecha limit 8
  loop
    j := j + 1;
    v_opp_alta := r.fecha + (1 + random() * 3) * interval '1 day';
    v_res := case when j <= 3 then 'ganada' when j = 4 then 'perdida' else 'abierta' end;
    perform pg_temp.como(coalesce(r.asignado_a, v_admin));
    insert into public.oportunidades
      (cliente_id, producto_servicio, importe_estimado, etapa, probabilidad, resultado,
       fecha_cierre_estimada, fecha_cierre, motivo_perdida, asignado_a)
    values (
      r.cliente_id,
      case when r.landing_id = v_l2 then 'Selección de personal' else 'Diplomatura en RRHH' end,
      case when r.landing_id = v_l2 then round((1200000 + random() * 1300000) / 1000) * 1000 else 510000 end,
      case when v_res = 'abierta' then 'propuesta' else 'negociacion' end,
      case when v_res = 'abierta' then 50 else 75 end,
      v_res,
      ((v_opp_alta + interval '15 days') at time zone 'America/Argentina/Buenos_Aires')::date,
      case when v_res <> 'abierta' then
        least(v_hoy, ((v_opp_alta + (3 + random() * 7) * interval '1 day') at time zone 'America/Argentina/Buenos_Aires')::date)
      end,
      case when v_res = 'perdida' then 'Postergó la decisión' end,
      coalesce(r.asignado_a, v_admin)
    )
    returning id into v_id;
    insert into alta values ('oportunidades', v_id, v_opp_alta);
  end loop;

  -- Usuarios: su alta y la baja de Lucía (la gestión de usuarios la registra la Edge Function)
  update public.usuarios set activo = false where id = v_lucia and activo;
  insert into public.auditoria (fecha, usuario_id, entidad, registro_id, accion, descripcion, cambios)
  select now() - interval '250 days' + (row_number() over (order by u.email)) * interval '2 hours',
         v_admin, 'usuarios', u.id::text, 'crear', u.nombre || ' ' || u.apellido,
         jsonb_build_object('nombre', u.nombre, 'apellido', u.apellido, 'email', u.email, 'rol', u.rol, 'activo', true)
    from public.usuarios u where u.email like '%@example.com';
  insert into public.auditoria (fecha, usuario_id, entidad, registro_id, accion, descripcion, cambios)
  values (now() - interval '20 days', v_admin, 'usuarios', v_lucia::text, 'desactivar', 'Lucía Benítez',
          '{"activo": {"antes": true, "despues": false}}');

  perform pg_temp.como(null);
end
$seed$;

-- ============================================================================
-- Fechas: lo cargado recién se lleva a su fecha real (sin disparar triggers)
-- ============================================================================
set local session_replication_role = replica;

update public.clientes c set creado_en = c.creado_en - k.delta, actualizado_en = c.actualizado_en - k.delta
  from corrimiento k where k.tabla = 'clientes' and k.id = c.id;
update public.actividades a
   set creado_en = a.creado_en - k.delta, actualizado_en = a.actualizado_en - k.delta,
       fecha = a.fecha - k.delta, completada_en = a.completada_en - k.delta
  from corrimiento k where k.tabla = 'actividades' and k.id = a.id;
update public.landing_envios e set creado_en = e.creado_en - k.delta, consentimiento_en = e.consentimiento_en - k.delta
  from corrimiento k where k.tabla = 'landing_envios' and k.id = e.id;
update public.auditoria au set fecha = au.fecha - k.delta
  from corrimiento k where k.tabla = 'auditoria' and k.id = au.id;

update public.clientes c set creado_en = a.creado, actualizado_en = a.creado
  from alta a where a.tabla = 'clientes' and a.id = c.id;
update public.oportunidades o set creado_en = a.creado, actualizado_en = a.creado
  from alta a where a.tabla = 'oportunidades' and a.id = o.id;
update public.actividades x set creado_en = a.creado, actualizado_en = a.creado
  from alta a where a.tabla = 'actividades' and a.id = x.id;

update public.clientes c set actualizado_en = greatest(c.creado_en, e.fecha)
  from edicion e where e.tabla = 'clientes' and e.id = c.id;
update public.oportunidades o set actualizado_en = greatest(o.creado_en, e.fecha)
  from edicion e where e.tabla = 'oportunidades' and e.id = o.id;
update public.actividades a
   set actualizado_en = greatest(a.creado_en, e.fecha),
       completada_en = case when a.completada then greatest(a.creado_en, e.fecha) end
  from edicion e where e.tabla = 'actividades' and e.id = a.id;

update public.landings
   set creado_en = now() - interval '50 days', actualizado_en = now() - interval '43 days',
       publicada_en = now() - interval '43 days'
 where slug in ('diplomatura-rrhh', 'seleccion-personal');
update public.landings set creado_en = now() - interval '6 days', actualizado_en = now() - interval '1 day'
 where slug = 'consultoria-pymes';

-- La auditoría de lo hecho por usuarios, con la fecha del registro
with registros as (
  select 'clientes' as entidad, id::text as registro_id, creado_en, actualizado_en from public.clientes
  union all select 'oportunidades', id::text, creado_en, actualizado_en from public.oportunidades
  union all select 'actividades', id::text, creado_en, actualizado_en from public.actividades
  union all select 'landings', id::text, creado_en, coalesce(publicada_en, actualizado_en) from public.landings
)
update public.auditoria au
   set fecha = case when au.accion = 'crear' then r.creado_en else r.actualizado_en end
  from registros r, inicio
 where au.id > inicio.auditoria_id
   and au.entidad = r.entidad and au.registro_id = r.registro_id
   and au.accion in ('crear', 'editar', 'publicar')
   and not exists (select 1 from corrimiento k where k.tabla = 'auditoria' and k.id = au.id);

commit;
