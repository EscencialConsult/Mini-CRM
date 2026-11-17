import {
  soloDigitos,
  validarDocumento,
  validarEmail,
  validarTelefono,
} from "../../domain/validators";

/** Máximo de filas por archivo: más es mejor partirlo (y revisar a mano). */
export const MAXIMO_FILAS = 2000;

export type CampoImportable =
  | "nombre"
  | "apellido"
  | "nombre_completo"
  | "razon_social"
  | "documento"
  | "telefono"
  | "email"
  | "direccion"
  | "canal";

/** Nombres de columna aceptados (sin tildes, mayúsculas ni signos). */
const SINONIMOS: Record<CampoImportable, string[]> = {
  nombre: ["nombre", "nombres", "name", "firstname"],
  apellido: ["apellido", "apellidos", "lastname", "surname"],
  nombre_completo: [
    "nombrecompleto",
    "nombreyapellido",
    "apellidoynombre",
    "contacto",
    "fullname",
  ],
  razon_social: ["razonsocial", "empresa", "company", "organizacion"],
  documento: ["documento", "dni", "cuit", "cuil", "cuitdni", "dnicuit"],
  telefono: [
    "telefono",
    "tel",
    "celular",
    "movil",
    "whatsapp",
    "phone",
    "telefonocelular",
  ],
  email: ["email", "correo", "mail", "correoelectronico", "emailcorreo"],
  direccion: ["direccion", "domicilio", "address"],
  canal: ["canal", "origen", "canaldeorigen", "fuente"],
};

export const normalizarTexto = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export interface ClienteImportable {
  tipo: "persona" | "empresa";
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}

export interface FilaImportable {
  /** Número de fila como la ve quien abre el archivo (la 1 es el encabezado). */
  numero: number;
  /** Lo que se guarda, ya normalizado. */
  cliente: ClienteImportable;
  /** Nombre del canal escrito en el archivo, si lo hay. */
  canal: string | null;
  /** Para mostrar: cómo se va a llamar. */
  etiqueta: string;
  /** Celdas originales, para el archivo de rechazados. */
  original: string[];
  /** Motivo por el que no se puede cargar (vacío si está bien). */
  error: string | null;
}

export interface Interpretacion {
  /** Columnas del archivo que no se reconocieron (se ignoran). */
  ignoradas: string[];
  /** Encabezados reconocidos, en el orden del archivo. */
  reconocidas: CampoImportable[];
  /** Falta alguna columna imprescindible. */
  problema: string | null;
  encabezado: string[];
  filas: FilaImportable[];
}

const recortar = (valor: string | undefined, largo: number): string | null => {
  const limpio = (valor ?? "").trim().replace(/\s+/g, " ");
  return limpio ? limpio.slice(0, largo) : null;
};

/** «Juan Pérez García» → nombre «Juan Pérez», apellido «García» (misma regla que las landings). */
const partirNombre = (completo: string) => {
  const palabras = completo.split(" ");
  return palabras.length > 1
    ? { nombre: palabras.slice(0, -1).join(" "), apellido: palabras.at(-1)! }
    : { nombre: completo, apellido: null };
};

/** Clave para detectar al mismo teléfono escrito distinto: los últimos 10 dígitos. */
export const claveTelefono = (telefono: string | null): string | null => {
  const digitos = soloDigitos(telefono ?? "");
  return digitos.length >= 8 ? digitos.slice(-10) : null;
};

const conCampo = (campo: string, mensaje: string | undefined) =>
  mensaje ? `${campo}: ${mensaje}` : undefined;

export const interpretarArchivo = (filas: string[][]): Interpretacion => {
  const [encabezado = [], ...cuerpo] = filas;
  const campoDe = new Map<number, CampoImportable>();
  const ignoradas: string[] = [];

  encabezado.forEach((titulo, indice) => {
    const clave = normalizarTexto(titulo);
    const campo = (Object.keys(SINONIMOS) as CampoImportable[]).find(
      (candidato) =>
        SINONIMOS[candidato].includes(clave) &&
        ![...campoDe.values()].includes(candidato),
    );
    if (campo) campoDe.set(indice, campo);
    else if (titulo.trim()) ignoradas.push(titulo.trim());
  });
  const reconocidas = [...campoDe.values()];

  const tieneIdentidad = reconocidas.some((campo) =>
    ["nombre", "nombre_completo", "razon_social"].includes(campo),
  );
  const tieneContacto = reconocidas.some((campo) =>
    ["telefono", "email"].includes(campo),
  );
  const problema = !tieneIdentidad
    ? "No encontré una columna de nombre. Usá la plantilla o poné «Nombre» (o «Razón social») en la primera fila."
    : !tieneContacto
      ? "No encontré una columna de teléfono ni de email: sin eso no hay cómo contactar a los prospectos."
      : cuerpo.length === 0
        ? "El archivo tiene solo el encabezado: no hay filas para cargar."
        : cuerpo.length > MAXIMO_FILAS
          ? `El archivo tiene ${cuerpo.length} filas y el máximo es ${MAXIMO_FILAS}. Partilo en varios archivos.`
          : null;

  const filasInterpretadas = cuerpo.map((celdas, posicion): FilaImportable => {
    const valor = (campo: CampoImportable): string | undefined => {
      for (const [indice, candidato] of campoDe) {
        if (candidato === campo) return celdas[indice];
      }
      return undefined;
    };

    let nombre = recortar(valor("nombre"), 80);
    let apellido = recortar(valor("apellido"), 80);
    const completo = recortar(valor("nombre_completo"), 160);
    if (!nombre && completo) ({ nombre, apellido } = partirNombre(completo));
    const razonSocial = recortar(valor("razon_social"), 120);
    const tipo = nombre ? "persona" : "empresa";
    const telefono = recortar(valor("telefono"), 40);
    const email = recortar(valor("email"), 120)?.toLowerCase() ?? null;
    const documento = soloDigitos(valor("documento") ?? "") || null;

    const cliente: ClienteImportable = {
      tipo,
      nombre: tipo === "persona" ? nombre : null,
      apellido: tipo === "persona" ? apellido : null,
      razon_social: tipo === "empresa" ? razonSocial : null,
      documento,
      telefono,
      email,
      direccion: recortar(valor("direccion"), 200),
    };

    const error = (tipo === "persona" ? !nombre : !razonSocial)
      ? "Falta el nombre"
      : !telefono && !email
        ? "Falta teléfono o email"
        : (conCampo("Teléfono", validarTelefono(telefono ?? "")) ??
          conCampo("Email", validarEmail(email ?? "")) ??
          conCampo("CUIT/DNI", validarDocumento(documento ?? "")) ??
          null);

    return {
      numero: posicion + 2,
      cliente,
      canal: recortar(valor("canal"), 80),
      etiqueta:
        tipo === "empresa"
          ? (razonSocial ?? "(sin nombre)")
          : [nombre, apellido].filter(Boolean).join(" ") || "(sin nombre)",
      original: celdas,
      error: error ?? null,
    };
  });

  return {
    ignoradas,
    reconocidas,
    problema,
    encabezado,
    filas: problema ? [] : filasInterpretadas,
  };
};

export interface Existentes {
  emails: Set<string>;
  telefonos: Set<string>;
  documentos: Set<string>;
}

export type Veredicto = "nueva" | "duplicada" | "invalida";

export interface FilaRevisada extends FilaImportable {
  veredicto: Veredicto;
  /** Por qué no se carga (error o duplicado). */
  motivo: string | null;
}

/**
 * Separa lo que se puede cargar de lo que no: filas inválidas, repetidas
 * dentro del archivo o que ya están en el CRM (mismo email, teléfono o CUIT/DNI).
 */
export const revisarFilas = (
  filas: FilaImportable[],
  existentes: Existentes,
): FilaRevisada[] => {
  const vistos: Existentes = {
    emails: new Set(),
    telefonos: new Set(),
    documentos: new Set(),
  };
  return filas.map((fila): FilaRevisada => {
    if (fila.error)
      return { ...fila, veredicto: "invalida", motivo: fila.error };

    const { email, documento, telefono } = fila.cliente;
    const clave = claveTelefono(telefono);
    const choque = (conjunto: keyof Existentes, valor: string | null) =>
      !!valor &&
      (existentes[conjunto].has(valor) || vistos[conjunto].has(valor));

    const motivo = choque("documentos", documento)
      ? "Ya existe un cliente con ese CUIT/DNI"
      : choque("emails", email)
        ? "Ya existe un cliente con ese email"
        : choque("telefonos", clave)
          ? "Ya existe un cliente con ese teléfono"
          : null;
    if (motivo) return { ...fila, veredicto: "duplicada", motivo };

    if (documento) vistos.documentos.add(documento);
    if (email) vistos.emails.add(email);
    if (clave) vistos.telefonos.add(clave);
    return { ...fila, veredicto: "nueva", motivo: null };
  });
};
