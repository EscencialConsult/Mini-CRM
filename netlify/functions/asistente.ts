// Asistente del CRM para administradores.
// - Lectura: las consultas viajan con el token del propio usuario, así que aplican el RLS.
// - Escritura: registrar_prospecto NO guarda nada. Devuelve una propuesta y el
//   administrador la confirma desde la UI; recién entonces se inserta (con su token).
export const config = { path: "/api/asistente" };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODELO = "claude-haiku-5-5";
const MAX_HISTORIAL = 8;
// Workspace de la cuenta de Anthropic (no es secreto; la clave sí lo es).
const WORKSPACE_ID = "wrkspc_012ioERRFCXomBbjUjnGv6bD";
const MAX_VUELTAS = 5;
const MAX_MENSAJES = 20;
const MAX_CARACTERES = 2000;

const SYSTEM = `Sos el asistente integrado del mini-CRM de una PyME argentina. Tu alcance es sólo este CRM.
Podés consultar clientes, oportunidades (pipeline), productos y el ranking de clientes por producto, y proponer el alta de un prospecto. Si preguntan por otra sección, decí que todavía no podés consultarla desde el asistente.
Reglas:
- Si la pregunta no es sobre el CRM, no la respondas. Decí en una frase que sólo ayudás con el CRM y ofrecé una consulta concreta (por ejemplo "¿cuántos clientes tengo?" o "resumen del pipeline").
- Usá las herramientas para cualquier dato. No estimes ni inventes cifras, nombres, fechas, teléfonos ni emails. Si una herramienta no trae el dato, decilo.
- Para registrar un prospecto usá registrar_prospecto con los datos que dio el usuario. El producto tiene que ser del catálogo: si el usuario no lo dice o no coincide, preguntale cuál es antes de proponer el alta. El alta todavía no se guarda: el administrador la confirma.
- Respondé en español rioplatense, breve. Los importes son en pesos argentinos (ARS).`;

const HERRAMIENTAS = [
  {
    name: "buscar_clientes",
    description:
      "Busca clientes por nombre, teléfono o email. Devuelve nombre, estado, oportunidades abiertas e importe abierto.",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto a buscar. Vacío devuelve los primeros por nombre. Devuelve el total exacto de coincidencias y hasta 'limite' resultados." },
        limite: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: "buscar_oportunidades",
    description: "Busca oportunidades del pipeline, filtrando por etapa y resultado (por defecto, abiertas).",
    input_schema: {
      type: "object",
      properties: {
        etapa: { type: "string", enum: ["prospecto", "calificado", "propuesta", "negociacion"] },
        resultado: { type: "string", enum: ["abierta", "ganada", "perdida"] },
        texto: { type: "string", description: "Texto a buscar en el producto o el cliente." },
        limite: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: "clientes_por_producto",
    description:
      "Ranking de productos o servicios por cantidad de clientes distintos que los tienen en oportunidades. Podés filtrar por abiertas o ganadas.",
    input_schema: {
      type: "object",
      properties: {
        resultado: {
          type: "string",
          enum: ["abierta", "ganada"],
          description: "Si se omite, cuenta todas las oportunidades.",
        },
      },
    },
  },
  {
    name: "resumen_pipeline",
    description: "Totales del pipeline abierto: cantidad e importe por etapa, y el importe ponderado por probabilidad.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "registrar_prospecto",
    description:
      "Propone registrar un prospecto nuevo (cliente + oportunidad en etapa prospecto) con un producto del catálogo. No lo guarda: el administrador debe confirmarlo. Usala sólo con datos que dio el usuario.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        apellido: { type: "string" },
        telefono: { type: "string" },
        email: { type: "string" },
        producto: { type: "string", description: "Nombre del producto o servicio de interés, tal como figura en el catálogo." },
        descripcion: { type: "string" },
      },
      required: ["nombre", "producto"],
    },
  },
];

type Contexto = { supabaseUrl: string; publishableKey: string; jwt: string };
type Entrada = Record<string, unknown>;
type Bloque =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Entrada };
type Mensaje = { role: "user" | "assistant"; content: unknown };

type Propuesta = {
  nombre: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  descripcion?: string;
  productoId: number;
  productoNombre: string;
  precio: number;
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json" },
  });

const texto = (valor: unknown, max: number): string | undefined =>
  typeof valor === "string" && valor.trim() ? valor.trim().slice(0, max) : undefined;

// Texto seguro para filtros de PostgREST (sin comas, paréntesis ni comodines).
const limpiarTexto = (valor: unknown) =>
  String(valor ?? "")
    .replace(/[,()*"\\%&#+]/g, " ")
    .trim()
    .slice(0, 80);

const limite = (valor: unknown) => Math.min(Math.max(Number(valor) || 10, 1), 20);

const consultar = async <T = unknown>(
  ctx: Contexto,
  tabla: string,
  query: string,
  conTotal = false,
): Promise<{ filas: T[]; total: number | null }> => {
  const res = await fetch(`${ctx.supabaseUrl}/rest/v1/${tabla}?${query}`, {
    headers: {
      apikey: ctx.publishableKey,
      Authorization: `Bearer ${ctx.jwt}`,
      ...(conTotal ? { Prefer: "count=exact" } : {}),
    },
  });
  if (!res.ok) throw new Error(`consulta a ${tabla} falló (${res.status})`);
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return { filas: (await res.json()) as T[], total: Number.isFinite(total) ? total : null };
};

const insertar = async <T>(ctx: Contexto, tabla: string, fila: Record<string, unknown>): Promise<T> => {
  const res = await fetch(`${ctx.supabaseUrl}/rest/v1/${tabla}`, {
    method: "POST",
    headers: {
      apikey: ctx.publishableKey,
      Authorization: `Bearer ${ctx.jwt}`,
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(fila),
  });
  if (!res.ok) throw new Error(`alta en ${tabla} falló (${res.status}): ${await res.text()}`);
  const [creada] = (await res.json()) as T[];
  return creada;
};

const borrarCliente = async (ctx: Contexto, id: number) => {
  await fetch(`${ctx.supabaseUrl}/rest/v1/clientes?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: ctx.publishableKey, Authorization: `Bearer ${ctx.jwt}` },
  });
};

// Datos de contacto comunes a la propuesta y a la confirmación.
const datosContacto = (e: Entrada) => {
  const nombre = texto(e.nombre, 80);
  if (!nombre) return null;
  const email = texto(e.email, 120)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return {
    nombre,
    apellido: texto(e.apellido, 80),
    telefono: texto(e.telefono, 30),
    email,
    descripcion: texto(e.descripcion, 500),
  };
};

const ejecutar = async (ctx: Contexto, nombre: string, entrada: Entrada): Promise<unknown> => {
  if (nombre === "buscar_clientes") {
    const t = limpiarTexto(entrada.texto);
    const filtro = t
      ? `&or=(nombre_completo.ilike.*${encodeURIComponent(t)}*,telefono.ilike.*${encodeURIComponent(t)}*,email.ilike.*${encodeURIComponent(t)}*)`
      : "";
    const { filas, total } = await consultar(
      ctx,
      "clientes_resumen",
      `select=id,nombre_completo,telefono,email,estado,oportunidades_abiertas,importe_abierto,proximo_contacto${filtro}&order=nombre_completo&limit=${limite(entrada.limite)}`,
      true,
    );
    return { total, resultados: filas };
  }

  if (nombre === "buscar_oportunidades") {
    const filtros = [`resultado=eq.${entrada.resultado === "ganada" || entrada.resultado === "perdida" ? entrada.resultado : "abierta"}`];
    if (typeof entrada.etapa === "string" && /^[a-z]+$/.test(entrada.etapa)) filtros.push(`etapa=eq.${entrada.etapa}`);
    const t = limpiarTexto(entrada.texto);
    if (t) {
      const e = encodeURIComponent(t);
      filtros.push(`or=(producto_servicio.ilike.*${e}*,cliente_nombre.ilike.*${e}*)`);
    }
    const { filas, total } = await consultar(
      ctx,
      "oportunidades_resumen",
      `select=id,producto_servicio,cliente_nombre,etapa,importe_estimado,probabilidad,resultado,fecha_cierre_estimada&${filtros.join("&")}&order=importe_estimado.desc&limit=${limite(entrada.limite)}`,
      true,
    );
    return { total, resultados: filas };
  }

  if (nombre === "clientes_por_producto") {
    const resultado = entrada.resultado === "abierta" || entrada.resultado === "ganada" ? entrada.resultado : null;
    const filtro = resultado ? `&resultado=eq.${resultado}` : "";
    const { filas: oportunidades } = await consultar<{
      cliente_id: number;
      productos: { producto_id: number; nombre?: string }[] | null;
    }>(ctx, "oportunidades_resumen", `select=cliente_id,productos${filtro}&limit=1000`);
    const { filas: catalogo } = await consultar<{ id: number; nombre: string }>(ctx, "productos", "select=id,nombre&limit=500");

    const porProducto = new Map<number, { clientes: Set<number>; oportunidades: number }>();
    for (const op of oportunidades) {
      for (const linea of op.productos ?? []) {
        const e = porProducto.get(linea.producto_id) ?? { clientes: new Set<number>(), oportunidades: 0 };
        e.clientes.add(op.cliente_id);
        e.oportunidades += 1;
        porProducto.set(linea.producto_id, e);
      }
    }

    const ranking = [...porProducto.entries()]
      .map(([productoId, e]) => ({
        producto: catalogo.find((p) => p.id === productoId)?.nombre ?? `Producto ${productoId}`,
        clientes: e.clientes.size,
        oportunidades: e.oportunidades,
      }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 10);

    return {
      filtro: resultado ?? "todas",
      ranking,
      oportunidadesAnalizadas: oportunidades.length,
      aviso: oportunidades.length >= 1000 ? "Se analizaron sólo las primeras 1000 oportunidades." : undefined,
    };
  }

  if (nombre === "resumen_pipeline") {
    const { filas } = await consultar<{ etapa: string; importe_estimado: number; probabilidad: number }>(
      ctx,
      "oportunidades_resumen",
      "select=etapa,importe_estimado,probabilidad&resultado=eq.abierta&limit=1000",
    );
    const porEtapa: Record<string, { cantidad: number; importe: number }> = {};
    let ponderado = 0;
    for (const f of filas) {
      const e = (porEtapa[f.etapa] ??= { cantidad: 0, importe: 0 });
      e.cantidad += 1;
      e.importe += Number(f.importe_estimado) || 0;
      ponderado += ((Number(f.importe_estimado) || 0) * (Number(f.probabilidad) || 0)) / 100;
    }
    return { porEtapa, ponderado: Math.round(ponderado), moneda: "ARS" };
  }

  throw new Error(`herramienta desconocida: ${nombre}`);
};

// Arma la propuesta de alta. No escribe nada.
const prepararProspecto = async (
  ctx: Contexto,
  entrada: Entrada,
): Promise<{ propuesta: Propuesta } | { mensaje: string }> => {
  const datos = datosContacto(entrada);
  if (!datos) return { mensaje: "Faltan datos válidos: el nombre es obligatorio y el email, si se da, debe tener formato correcto." };

  const interes = limpiarTexto(entrada.producto);
  if (!interes) return { mensaje: "Falta el producto o servicio de interés. Preguntale al usuario cuál es." };

  const filtros = [
    datos.telefono && `telefono.eq.${encodeURIComponent(datos.telefono)}`,
    datos.email && `email.eq.${encodeURIComponent(datos.email)}`,
  ].filter(Boolean);
  if (filtros.length) {
    const { filas } = await consultar<{ nombre_completo: string }>(
      ctx,
      "clientes_resumen",
      `select=nombre_completo&or=(${filtros.join(",")})&limit=1`,
    );
    if (filas[0]) return { mensaje: `Ya existe un cliente con ese teléfono o email: ${filas[0].nombre_completo}. No se registra de nuevo.` };
  }

  const { filas: coincidencias } = await consultar<{ id: number; nombre: string; precio: number }>(
    ctx,
    "productos",
    `select=id,nombre,precio&activo=eq.true&nombre=ilike.*${encodeURIComponent(interes)}*&limit=5`,
  );
  if (coincidencias.length === 0) {
    const { filas: activos } = await consultar<{ nombre: string }>(ctx, "productos", "select=nombre&activo=eq.true&order=nombre&limit=30");
    return { mensaje: `No hay un producto activo que coincida con "${interes}". Productos disponibles: ${activos.map((p) => p.nombre).join(", ")}.` };
  }
  const exacto = coincidencias.find((p) => p.nombre.toLowerCase() === interes.toLowerCase());
  if (!exacto && coincidencias.length > 1) {
    return { mensaje: `Hay varios productos que coinciden: ${coincidencias.map((p) => p.nombre).join(", ")}. Pedile al usuario que elija uno.` };
  }
  const producto = exacto ?? coincidencias[0];

  return {
    propuesta: {
      ...datos,
      productoId: producto.id,
      productoNombre: producto.nombre,
      precio: Number(producto.precio) || 0,
    },
  };
};

// Valida lo que llega desde la UI al confirmar. El precio no se toma del cliente: lo recalcula la base.
const validarConfirmacion = (valor: unknown) => {
  if (!valor || typeof valor !== "object") return null;
  const e = valor as Entrada;
  const datos = datosContacto(e);
  const productoId = Number(e.productoId);
  if (!datos || !Number.isInteger(productoId) || productoId <= 0) return null;
  return { ...datos, productoId };
};

type DatosConfirmados = NonNullable<ReturnType<typeof validarConfirmacion>>;

// Cliente + oportunidad. Si la oportunidad falla, se borra el cliente para no dejar un alta a medias.
const registrarProspecto = async (ctx: Contexto, p: DatosConfirmados, asignado: string) => {
  const cliente = await insertar<{ id: number }>(ctx, "clientes", {
    tipo: "persona",
    nombre: p.nombre,
    apellido: p.apellido ?? null,
    telefono: p.telefono ?? null,
    email: p.email ?? null,
    estado: "activo",
    asignado_a: asignado,
  });
  try {
    // El trigger de la base completa producto_servicio e importe a partir de productos.
    await insertar(ctx, "oportunidades", {
      cliente_id: cliente.id,
      descripcion: p.descripcion ?? null,
      etapa: "prospecto",
      probabilidad: 10,
      resultado: "abierta",
      productos: [{ producto_id: p.productoId, cantidad: 1, descuento: 0 }],
      asignado_a: asignado,
    });
  } catch (error) {
    await borrarCliente(ctx, cliente.id);
    throw error;
  }
  return cliente.id;
};

const validarMensajes = (valor: unknown): Mensaje[] | null => {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > MAX_MENSAJES) return null;
  const salida: Mensaje[] = [];
  for (const m of valor as { role?: unknown; content?: unknown }[]) {
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    if (m.content.length === 0 || m.content.length > MAX_CARACTERES) return null;
    salida.push({ role: m.role, content: m.content });
  }
  // Sólo el último tramo de la charla: menos tokens por consulta.
  const recientes = salida.slice(-MAX_HISTORIAL);
  while (recientes.length && recientes[0].role !== "user") recientes.shift();
  return recientes.length ? recientes : null;
};

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SB_PUBLISHABLE_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !publishableKey || !apiKey) {
    return json({ error: "El servidor no tiene configuradas las variables del asistente" }, 500);
  }

  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return json({ error: "No autenticado" }, 401);

  const ctx: Contexto = { supabaseUrl, publishableKey, jwt };

  const usuarioRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${jwt}` },
  });
  if (!usuarioRes.ok) return json({ error: "Sesión inválida" }, 401);
  const { id } = (await usuarioRes.json()) as { id: string };

  // Sólo administradores activos. La UI también lo oculta, pero esta validación es la que vale.
  const { filas: [perfil] } = await consultar(ctx, "usuarios", `select=activo,rol&id=eq.${id}`);
  const { activo, rol } = (perfil ?? {}) as { activo?: boolean; rol?: string };
  if (!activo) return json({ error: "Usuario inactivo" }, 403);
  if (rol !== "administrador") return json({ error: "El asistente es sólo para administradores" }, 403);

  const cuerpo = (await req.json().catch(() => null)) as { mensajes?: unknown; confirmar?: unknown } | null;

  // Confirmación de una propuesta de alta.
  if (cuerpo?.confirmar !== undefined) {
    const datos = validarConfirmacion(cuerpo.confirmar);
    if (!datos) return json({ error: "Datos del prospecto inválidos" }, 400);
    try {
      await registrarProspecto(ctx, datos, id);
      return json({ respuesta: `Listo: registré a ${datos.nombre} como prospecto con interés en el producto del catálogo que confirmaste.` });
    } catch (error) {
      console.error("Alta de prospecto falló", error);
      return json({ error: "No se pudo registrar el prospecto. Revisá los datos e intentá de nuevo." }, 500);
    }
  }

  const mensajes = validarMensajes(cuerpo?.mensajes);
  if (!mensajes) return json({ error: "Mensajes inválidos" }, 400);

  const hoy = new Date().toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "full",
  });
  const system = `${SYSTEM}\nFecha de hoy: ${hoy}.`;

  const conversacion: Mensaje[] = [...mensajes];

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-workspace-id": WORKSPACE_ID,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 600,
        system,
        tools: HERRAMIENTAS,
        messages: conversacion,
      }),
    });
    if (!res.ok) {
      console.error("Anthropic respondió", res.status, await res.text());
      return json({ error: "El asistente no está disponible en este momento" }, 502);
    }

    const data = (await res.json()) as { content: Bloque[]; stop_reason: string };

    if (data.stop_reason !== "tool_use") {
      const respuesta = data.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return json({ respuesta: respuesta || "No tengo una respuesta para eso." });
    }

    conversacion.push({ role: "assistant", content: data.content });

    const resultados = [];
    for (const bloque of data.content) {
      if (bloque.type !== "tool_use") continue;
      try {
        if (bloque.name === "registrar_prospecto") {
          const r = await prepararProspecto(ctx, bloque.input ?? {});
          // Corta acá: la alta sólo ocurre cuando el administrador la confirma.
          if ("propuesta" in r) {
            return json({ respuesta: "Revisá los datos y confirmá para registrar el prospecto.", propuesta: r.propuesta });
          }
          resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: r.mensaje });
          continue;
        }
        const salida = await ejecutar(ctx, bloque.name, bloque.input ?? {});
        resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: JSON.stringify(salida) });
      } catch (error) {
        const detalle = error instanceof Error ? error.message : "error desconocido";
        resultados.push({ type: "tool_result", tool_use_id: bloque.id, content: `Error: ${detalle}`, is_error: true });
      }
    }
    conversacion.push({ role: "user", content: resultados });
  }

  return json({ respuesta: "No pude completar la consulta. Probá con una pregunta más específica." });
};
