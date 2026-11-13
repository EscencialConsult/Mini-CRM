-- Mini-CRM · prueba de aislamiento entre cuentas.
--
-- Crea dos cuentas (X e Y) con datos, actúa como cada usuario y comprueba que
-- nadie ve ni toca lo de la otra. Cualquier falla corta con «FALLO: …».
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja nada.
-- Aun así, correrla en una base de pruebas (consume números de identidad).
--
--   npm run db:psql -- -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento_cuentas.sql
--
-- Al final imprime «aislamiento_ok».

begin;

-- ----------------------------------------------------------------------------
-- Datos: cuenta X (adminX plataforma, vendX) y cuenta Y (adminY)
-- ----------------------------------------------------------------------------
do $$
declare
  x bigint; y bigint;
  u_ax uuid := gen_random_uuid(); u_vx uuid := gen_random_uuid(); u_ay uuid := gen_random_uuid();
  u_pp uuid := gen_random_uuid();
  v_json jsonb := '{"form":{"fields":[{"id":"n","type":"text","target":"full_name","label":"Nombre","required":true},{"id":"e","type":"email","target":"email","label":"Email"}],"consent":{"enabled":false}},"carrito":{"activo":true,"entrega":"ninguna"}}'::jsonb;
  c_x bigint; c_y bigint; p_x bigint; p_y bigint; ped_x bigint; l_x bigint; l_y bigint; c_x2 bigint;
begin
  insert into public.cuentas (nombre) values ('Prueba X') returning id into x;
  insert into public.cuentas (nombre) values ('Prueba Y') returning id into y;
  perform public.cuenta_sembrar(x);
  perform public.cuenta_sembrar(y);

  insert into auth.users (id, aud, role, email) values
    (u_ax, 'authenticated', 'authenticated', 'admin-x@prueba.invalid'),
    (u_vx, 'authenticated', 'authenticated', 'vend-x@prueba.invalid'),
    (u_ay, 'authenticated', 'authenticated', 'admin-y@prueba.invalid'),
    (u_pp, 'authenticated', 'authenticated', 'admin-principal@prueba.invalid');
  insert into public.usuarios (id, nombre, apellido, email, rol, cuenta_id, modulos, plataforma) values
    (u_ax, 'Admin', 'X', 'admin-x@prueba.invalid', 'administrador', x, '{}', true),
    (u_vx, 'Vend', 'X', 'vend-x@prueba.invalid', 'vendedor', x, '{panel,clientes,oportunidades,actividades}', false),
    (u_ay, 'Admin', 'Y', 'admin-y@prueba.invalid', 'administrador', y, '{}', false),
    -- administrador de la cuenta principal (la de menor id)
    (u_pp, 'Admin', 'Principal', 'admin-principal@prueba.invalid', 'administrador', public.cuenta_principal(), '{}', false);

  insert into public.clientes (cuenta_id, tipo, nombre, apellido, email, documento)
    values (x, 'persona', 'Ana', 'DeX', 'compartido@prueba.invalid', '20111222')
    returning id into c_x;
  insert into public.clientes (cuenta_id, tipo, nombre, apellido)
    values (x, 'persona', 'Borrable', 'DeX')
    returning id into c_x2;
  insert into public.actividades (cuenta_id, tipo, cliente_id, titulo)
    values (x, 'nota', c_x2, 'tarea-del-borrable');
  insert into public.clientes (cuenta_id, tipo, nombre, apellido, documento)
    values (y, 'persona', 'Beto', 'DeY', '20111222')   -- mismo documento: permitido entre cuentas
    returning id into c_y;
  insert into public.productos (cuenta_id, nombre, precio) values (x, 'Producto X', 100) returning id into p_x;
  insert into public.productos (cuenta_id, nombre, precio) values (y, 'Producto Y', 200) returning id into p_y;
  insert into public.etiquetas (cuenta_id, nombre) values (x, 'Etiqueta') ;
  insert into public.etiquetas (cuenta_id, nombre) values (y, 'Etiqueta');   -- mismo nombre: permitido

  insert into public.pedidos (cliente_id, origen, tipo_entrega, productos)
    values (c_x, 'manual', 'retiro', jsonb_build_array(jsonb_build_object('producto_id', p_x, 'cantidad', 1)))
    returning id into ped_x;

  insert into public.landings (cuenta_id, nombre, slug, estado, borrador, publicada) values
    (x, 'Landing X', 'prueba-aislamiento-x', 'publicada', v_json, v_json)
    returning id into l_x;
  insert into public.landings (cuenta_id, nombre, slug, estado, borrador, publicada) values
    (y, 'Landing Y', 'prueba-aislamiento-y', 'publicada', v_json, v_json)
    returning id into l_y;

  perform set_config('t.x', x::text, true);       perform set_config('t.y', y::text, true);
  perform set_config('t.ax', u_ax::text, true);   perform set_config('t.vx', u_vx::text, true);
  perform set_config('t.ay', u_ay::text, true);   perform set_config('t.pp', u_pp::text, true);
  perform set_config('t.c_x', c_x::text, true);   perform set_config('t.c_y', c_y::text, true);
  perform set_config('t.c_x2', c_x2::text, true);
  perform set_config('t.p_x', p_x::text, true);   perform set_config('t.p_y', p_y::text, true);
  perform set_config('t.ped_x', ped_x::text, true);
  perform set_config('t.l_x', l_x::text, true);   perform set_config('t.l_y', l_y::text, true);
end $$;

-- ----------------------------------------------------------------------------
-- 1) El administrador de Y solo ve y toca lo de Y
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', current_setting('t.ay'), true);
set local role authenticated;

do $$
declare
  n int;
  y bigint := current_setting('t.y')::bigint;
  v_id bigint;
  e1 text; e2 text;
begin
  select count(*) into n from public.clientes;
  if n <> 1 then raise exception 'FALLO: Y debería ver 1 cliente y ve %', n; end if;
  select count(*) into n from public.clientes where nombre = 'Ana';
  if n <> 0 then raise exception 'FALLO: Y ve un cliente de X'; end if;
  select count(*) into n from public.clientes_resumen where nombre_completo like '%DeX%';
  if n <> 0 then raise exception 'FALLO: Y ve un cliente de X por la vista'; end if;
  select count(*) into n from public.usuarios;
  if n <> 1 then raise exception 'FALLO: Y debería ver 1 usuario y ve %', n; end if;
  select count(*) into n from public.cuentas;
  if n <> 1 then raise exception 'FALLO: Y debería ver 1 cuenta y ve %', n; end if;
  select count(*) into n from public.productos;
  if n <> 1 then raise exception 'FALLO: Y debería ver 1 producto y ve %', n; end if;
  select count(*) into n from public.pedidos;
  if n <> 0 then raise exception 'FALLO: Y ve pedidos de X'; end if;
  select count(*) into n from public.landings;
  if n <> 1 then raise exception 'FALLO: Y debería ver 1 landing y ve %', n; end if;
  select count(*) into n from public.canales;
  if n <> 10 then raise exception 'FALLO: Y debería ver sus 10 canales y ve %', n; end if;
  if public.es_plataforma() then raise exception 'FALLO: adminY no es plataforma'; end if;

  -- Modificar o borrar lo de X no toca ninguna fila
  update public.clientes set telefono = '1111' where id = current_setting('t.c_x')::bigint;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Y editó un cliente de X'; end if;
  delete from public.clientes where id = current_setting('t.c_x')::bigint;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Y borró un cliente de X'; end if;

  -- Un alta propia queda en su cuenta, sin que mande cuenta_id
  insert into public.clientes (tipo, nombre, apellido) values ('persona', 'Nuevo', 'DeY') returning id into v_id;
  if (select cuenta_id from public.clientes where id = v_id) <> y then
    raise exception 'FALLO: el cliente nuevo no quedó en la cuenta de Y';
  end if;

  -- Escribir en otra cuenta, o referenciar lo ajeno, se rechaza
  begin
    insert into public.clientes (cuenta_id, tipo, nombre, apellido)
      values (current_setting('t.x')::bigint, 'persona', 'Intruso', 'X');
    raise exception 'FALLO: Y creó un cliente en la cuenta X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    insert into public.oportunidades (cliente_id, productos)
      values (current_setting('t.c_x')::bigint, '[]');
    raise exception 'FALLO: Y creó una oportunidad sobre un cliente de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    insert into public.actividades (tipo, cliente_id, titulo)
      values ('nota', current_setting('t.c_x')::bigint, 'intruso');
    raise exception 'FALLO: Y creó una actividad sobre un cliente de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    insert into public.oportunidades (cliente_id, productos)
      values (v_id, jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.p_x')::bigint, 'cantidad', 1)));
    raise exception 'FALLO: Y vendió un producto de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    perform public.pedido_cambiar_estado(current_setting('t.ped_x')::bigint, 'en_preparacion');
    raise exception 'FALLO: Y cambió el estado de un pedido de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    perform public.landing_publicar(current_setting('t.l_x')::bigint);
    raise exception 'FALLO: Y publicó una landing de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;

  -- Una referencia ajena y una inexistente dan el MISMO error: no se puede averiguar qué ids existen
  begin
    insert into public.oportunidades (cliente_id, productos) values (current_setting('t.c_x')::bigint, '[]');
  exception when others then
    e1 := sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.oportunidades (cliente_id, productos) values (9000000000000, '[]');
  exception when others then
    e2 := sqlstate || ' ' || sqlerrm;
  end;
  if e1 is null or e2 is null then raise exception 'FALLO: una referencia ajena o inexistente no dio error'; end if;
  if e1 <> e2 then raise exception 'FALLO: ajeno (%) e inexistente (%) dan errores distintos', e1, e2; end if;

  -- El responsable de un cliente tiene que ser de la misma cuenta
  begin
    insert into public.clientes (tipo, nombre, apellido, asignado_a)
      values ('persona', 'Asignado', 'Ajeno', current_setting('t.vx')::uuid);
    raise exception 'FALLO: Y asignó un cliente a un usuario de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;

  -- Lo propio sí funciona (regresión: nada se rompió para una cuenta sola)
  insert into public.oportunidades (cliente_id, productos)
    values (v_id, jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.p_y')::bigint, 'cantidad', 2)));
  insert into public.actividades (tipo, cliente_id, titulo) values ('nota', v_id, 'propia');
  perform public.landing_publicar(current_setting('t.l_y')::bigint);
  if (select count(*) from public.panel_indicadores(current_date - 30, current_date)) < 0 then
    raise exception 'FALLO: el panel no responde';
  end if;
end $$;

-- Imágenes de landings: solo en la carpeta de la propia cuenta
do $$
begin
  insert into storage.objects (bucket_id, name) values ('landing-imagenes', current_setting('t.y') || '/foto.png');
  begin
    insert into storage.objects (bucket_id, name) values ('landing-imagenes', current_setting('t.x') || '/foto.png');
    raise exception 'FALLO: Y subió una imagen a la carpeta de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('landing-imagenes', 'suelta.png');
    raise exception 'FALLO: Y subió una imagen a la raíz (es de la cuenta principal)';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- La cuenta principal conserva la raíz del bucket (lo subido antes de las cuentas)
select set_config('request.jwt.claim.sub', current_setting('t.pp'), true);
set local role authenticated;
do $$
begin
  insert into storage.objects (bucket_id, name) values ('landing-imagenes', 'raiz-principal.png');
  begin
    insert into storage.objects (bucket_id, name) values ('landing-imagenes', current_setting('t.x') || '/ajena.png');
    raise exception 'FALLO: la cuenta principal subió una imagen a la carpeta de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;
reset role;

-- Y no lee ni borra lo que la principal tiene en la raíz del bucket
select set_config('request.jwt.claim.sub', current_setting('t.ay'), true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from storage.objects where name = 'raiz-principal.png';
  if n <> 0 then raise exception 'FALLO: Y ve una imagen de la raíz (de la cuenta principal)'; end if;
  delete from storage.objects where name = 'raiz-principal.png';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Y borró una imagen de la cuenta principal'; end if;
end $$;
reset role;

-- ----------------------------------------------------------------------------
-- 2) La plataforma (adminX) ve todas las cuentas pero no los datos de las demás
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', current_setting('t.ax'), true);
set local role authenticated;

do $$
declare n int;
begin
  if not public.es_plataforma() then raise exception 'FALLO: adminX debería ser plataforma'; end if;
  select count(*) into n from public.cuentas where id in (current_setting('t.x')::bigint, current_setting('t.y')::bigint);
  if n <> 2 then raise exception 'FALLO: la plataforma debería ver las 2 cuentas de prueba y ve %', n; end if;
  select count(*) into n from public.clientes where nombre in ('Beto', 'Nuevo');
  if n <> 0 then raise exception 'FALLO: la plataforma ve clientes de otra cuenta'; end if;
  select count(*) into n from public.usuarios where cuenta_id = current_setting('t.y')::bigint;
  if n <> 0 then raise exception 'FALLO: la plataforma ve usuarios de otra cuenta'; end if;
end $$;

reset role;

-- ----------------------------------------------------------------------------
-- 3) Cuenta suspendida y techo de módulos
-- ----------------------------------------------------------------------------
update public.cuentas set activa = false where id = current_setting('t.y')::bigint;
select set_config('request.jwt.claim.sub', current_setting('t.ay'), true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.clientes;
  if n <> 0 then raise exception 'FALLO: una cuenta suspendida sigue viendo clientes (%)', n; end if;
  begin
    insert into public.clientes (tipo, nombre, apellido) values ('persona', 'Suspendido', 'Y');
    raise exception 'FALLO: una cuenta suspendida creó un cliente';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;
reset role;

update public.cuentas set activa = true, modulos = '{panel,clientes}' where id = current_setting('t.y')::bigint;
select set_config('request.jwt.claim.sub', current_setting('t.ay'), true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.clientes;
  if n = 0 then raise exception 'FALLO: con el módulo Clientes comprado no ve clientes'; end if;
  select count(*) into n from public.oportunidades;
  if n <> 0 then raise exception 'FALLO: ve oportunidades sin tener el módulo comprado (%)', n; end if;
  begin
    insert into public.actividades (tipo, cliente_id, titulo)
      values ('nota', current_setting('t.c_y')::bigint, 'sin módulo');
    raise exception 'FALLO: creó una actividad sin el módulo comprado';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;
reset role;

-- Una cuenta suspendida, o sin el módulo Landings, no atiende sus landings públicas
update public.cuentas set activa = false, modulos = default where id = current_setting('t.y')::bigint;
set local role anon;
do $$
begin
  begin
    perform public.landing_recibir(jsonb_build_object(
      'slug', 'prueba-aislamiento-y', 'answers', jsonb_build_object('n', 'Zoe Suspendida')));
    raise exception 'FALLO: la landing de una cuenta suspendida recibió un contacto';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  if public.landing_publica('prueba-aislamiento-y') is not null then
    raise exception 'FALLO: la landing de una cuenta suspendida sigue publicada';
  end if;
  if jsonb_array_length(public.landing_productos('prueba-aislamiento-y')) <> 0 then
    raise exception 'FALLO: el carrito de una cuenta suspendida sigue ofreciendo productos';
  end if;
end $$;
reset role;

update public.cuentas
   set activa = true, modulos = '{panel,clientes,oportunidades,pedidos,actividades,productos,ventas,etiquetas,auditoria}'
 where id = current_setting('t.y')::bigint;
set local role anon;
do $$
begin
  if public.landing_publica('prueba-aislamiento-y') is not null then
    raise exception 'FALLO: una cuenta sin el módulo Landings sigue publicando';
  end if;
end $$;
reset role;

-- ----------------------------------------------------------------------------
-- 4) Reglas de usuarios por cuenta
-- ----------------------------------------------------------------------------
do $$
declare y bigint := current_setting('t.y')::bigint;
begin
  -- máximo de usuarios activos: Y ya tiene 1 y el máximo es 1
  update public.cuentas set max_usuarios = 1 where id = y;
  begin
    insert into auth.users (id, aud, role, email) values ('00000000-0000-0000-0000-0000000000aa', 'authenticated', 'authenticated', 'extra-y@prueba.invalid');
    insert into public.usuarios (id, nombre, apellido, email, rol, cuenta_id)
      values ('00000000-0000-0000-0000-0000000000aa', 'Extra', 'Y', 'extra-y@prueba.invalid', 'vendedor', y);
    raise exception 'FALLO: se superó el máximo de usuarios de la cuenta';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  update public.cuentas set max_usuarios = null where id = y;

  -- el último administrador de la cuenta no se puede dar de baja (aunque otras cuentas tengan)
  begin
    update public.usuarios set activo = false where id = current_setting('t.ay')::uuid;
    raise exception 'FALLO: se dio de baja al único administrador de la cuenta Y';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;

  -- sin RLS (como las funciones SECURITY DEFINER) un pedido tampoco mezcla productos de otra cuenta
  begin
    insert into public.pedidos (cliente_id, origen, tipo_entrega, productos)
      values (
        current_setting('t.c_y')::bigint, 'manual', 'retiro',
        jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.p_x')::bigint, 'cantidad', 1))
      );
    raise exception 'FALLO: un pedido de Y aceptó un producto de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;

  -- los canales de sistema son por cuenta: cada una tiene el suyo
  if (select count(*) from public.canales where clave = 'landing' and cuenta_id in (current_setting('t.x')::bigint, y)) <> 2 then
    raise exception 'FALLO: cada cuenta debe tener su canal Landing';
  end if;
end $$;

-- Sin sesión (clave de servicio, scripts) y con varias cuentas, un usuario nuevo tiene que decir su cuenta
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    insert into auth.users (id, aud, role, email)
      values ('00000000-0000-0000-0000-0000000000bb', 'authenticated', 'authenticated', 'sin-cuenta@prueba.invalid');
    insert into public.usuarios (id, nombre, apellido, email, rol)
      values ('00000000-0000-0000-0000-0000000000bb', 'Sin', 'Cuenta', 'sin-cuenta@prueba.invalid', 'vendedor');
    raise exception 'FALLO: se creó un usuario sin cuenta habiendo varias cuentas';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ----------------------------------------------------------------------------
-- 5) Landings públicas (sin sesión): cada una lee y escribe en SU cuenta
-- ----------------------------------------------------------------------------
update public.cuentas set modulos = default where id = current_setting('t.y')::bigint;
set local role anon;
do $$
declare
  r jsonb;
  c_y_antes int; c_x_antes int; n int;
begin
  begin
    perform public.mi_cuenta();
    raise exception 'FALLO: anon puede ejecutar mi_cuenta()';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;

  -- un visitante de la landing de Y con el MISMO email que un cliente de X
  r := public.landing_recibir(jsonb_build_object(
    'slug', 'prueba-aislamiento-y',
    'answers', jsonb_build_object('n', 'Carla Visitante', 'e', 'compartido@prueba.invalid')
  ));
  if r ->> 'ok' is distinct from 'true' then raise exception 'FALLO: landing_recibir no respondió ok'; end if;

  -- el catálogo del carrito es el de la cuenta de la landing
  r := public.landing_productos('prueba-aislamiento-y');
  if jsonb_array_length(r) <> 1 or r -> 0 ->> 'nombre' <> 'Producto Y' then
    raise exception 'FALLO: el carrito de Y muestra productos de otra cuenta: %', r;
  end if;

  -- pedir un producto de otra cuenta desde la landing de Y se rechaza
  begin
    perform public.landing_recibir(jsonb_build_object(
      'slug', 'prueba-aislamiento-y',
      'answers', jsonb_build_object('n', 'Dario Pedido', 'e', 'dario@prueba.invalid'),
      'lineas', jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.p_x')::bigint, 'cantidad', 1))
    ));
    raise exception 'FALLO: la landing de Y aceptó un producto de X';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;

  -- y uno propio se acepta
  r := public.landing_recibir(jsonb_build_object(
    'slug', 'prueba-aislamiento-y',
    'answers', jsonb_build_object('n', 'Eva Pedido', 'e', 'eva@prueba.invalid'),
    'lineas', jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.p_y')::bigint, 'cantidad', 3))
  ));
  if r ->> 'pedido_id' is null then raise exception 'FALLO: el pedido propio de la landing no se creó'; end if;
end $$;
reset role;

do $$
declare x bigint := current_setting('t.x')::bigint; y bigint := current_setting('t.y')::bigint; n int;
begin
  -- Carla quedó como cliente NUEVO de Y; el cliente de X no se tocó
  if not exists (select 1 from public.clientes where nombre = 'Carla' and cuenta_id = y) then
    raise exception 'FALLO: el visitante de la landing de Y no quedó en la cuenta Y';
  end if;
  select count(*) into n from public.clientes where cuenta_id = x and nombre = 'Carla';
  if n <> 0 then raise exception 'FALLO: el visitante de Y se mezcló con un cliente de X'; end if;
  if (select count(*) from public.actividades where cuenta_id = x and titulo like '%Landing Y%') <> 0 then
    raise exception 'FALLO: la landing de Y escribió actividades en la cuenta X';
  end if;
  -- el pedido y su envío quedaron en Y
  if (select count(*) from public.pedidos p where p.cuenta_id = y and p.origen = 'landing') <> 1 then
    raise exception 'FALLO: el pedido de la landing no quedó en la cuenta Y';
  end if;
  if (select count(*) from public.landing_envios where cuenta_id = y) < 2 then
    raise exception 'FALLO: los envíos de la landing no quedaron en la cuenta Y';
  end if;
  -- entregarlo crea la venta en Y, con el canal Landing de Y
  perform public.pedido_cambiar_estado(
    (select id from public.pedidos where cuenta_id = y and origen = 'landing'), 'entregado');
  if not exists (
    select 1 from public.oportunidades o
    join public.canales ca on ca.id = o.canal_id
    where o.cuenta_id = y and o.pedido_id is not null and ca.cuenta_id = y and ca.clave = 'landing'
  ) then
    raise exception 'FALLO: la venta del pedido no quedó en la cuenta Y con su canal';
  end if;
  -- la auditoría de lo que hizo la landing quedó en Y
  if (select count(*) from public.auditoria where cuenta_id = x and origen like '%Landing Y%') <> 0 then
    raise exception 'FALLO: auditoría de la landing de Y en la cuenta X';
  end if;
end $$;

-- Sin sesión (clave de servicio, psql) la auditoría queda en la cuenta de la propia fila
select set_config('request.jwt.claim.sub', '', true);
do $$
declare x bigint := current_setting('t.x')::bigint;
begin
  delete from public.clientes where id = current_setting('t.c_x2')::bigint;
  if exists (
    select 1 from public.auditoria
    where cuenta_id <> x and (descripcion like '%Borrable%' or descripcion = 'tarea-del-borrable')
  ) then
    raise exception 'FALLO: la auditoría de un borrado sin sesión quedó en otra cuenta';
  end if;
  if not exists (
    select 1 from public.auditoria where cuenta_id = x and accion = 'eliminar' and descripcion like '%Borrable%'
  ) then
    raise exception 'FALLO: la auditoría del borrado no quedó en la cuenta de X';
  end if;
end $$;

-- Alta completa de una cuenta en una transacción: cuenta + canales + titular, o nada
do $$
declare
  n_antes int; n_despues int; r public.cuentas; u_nuevo uuid := gen_random_uuid();
begin
  select count(*) into n_antes from public.cuentas;
  -- Falla al final (el titular ya existe): no puede quedar la cuenta ni sus canales
  begin
    perform public.cuenta_alta('Cuenta Atómica', array['panel'], 3, current_setting('t.ay')::uuid, 'atomica@prueba.invalid', 'At', 'Omica');
    raise exception 'FALLO: cuenta_alta aceptó un titular repetido';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  select count(*) into n_despues from public.cuentas;
  if n_antes <> n_despues or exists (
    select 1 from public.canales ca join public.cuentas cu on cu.id = ca.cuenta_id where cu.nombre = 'Cuenta Atómica'
  ) then
    raise exception 'FALLO: cuenta_alta dejó datos a medias';
  end if;

  insert into auth.users (id, aud, role, email)
    values (u_nuevo, 'authenticated', 'authenticated', 'buena@prueba.invalid');
  r := public.cuenta_alta('Cuenta Buena', array['panel', 'clientes'], null, u_nuevo, 'buena@prueba.invalid', 'Bu', 'Ena');
  if (select count(*) from public.canales where cuenta_id = r.id) <> 10 then
    raise exception 'FALLO: faltan los canales de sistema de la cuenta nueva';
  end if;
  if not exists (select 1 from public.usuarios where id = u_nuevo and cuenta_id = r.id and rol = 'administrador') then
    raise exception 'FALLO: falta el administrador titular de la cuenta nueva';
  end if;
  if r.modulos <> array['panel', 'clientes'] then
    raise exception 'FALLO: los módulos de la cuenta nueva no son los pedidos';
  end if;
end $$;

select 'aislamiento_ok' as resultado;

rollback;
