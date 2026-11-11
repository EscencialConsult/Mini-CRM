export interface ErrorReport {
  /** Mensaje corto para la persona usuaria. */
  resumen: string;
  /** Texto completo para copiar y enviar al administrador. */
  detalle: string;
}

interface Contexto {
  usuario?: string;
  pantalla: string;
  componentes?: string;
}

const CODIGOS = ["code", "status", "requestId", "request_id"] as const;

const aTexto = (valor: unknown): string => {
  if (valor instanceof Error) return valor.message;
  if (typeof valor === "string") return valor;
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
};

/** Código o identificador de petición que traiga el error (Supabase / PostgREST / ra-core). */
const codigosDe = (error: unknown): string[] => {
  if (typeof error !== "object" || error === null) return [];
  const registro = error as Record<string, unknown>;
  const cuerpo =
    typeof registro.body === "object" && registro.body !== null
      ? (registro.body as Record<string, unknown>)
      : {};
  return CODIGOS.flatMap((clave) => {
    const valor = registro[clave] ?? cuerpo[clave];
    return valor === undefined || valor === null
      ? []
      : [`${clave}: ${String(valor)}`];
  });
};

/** Arma el reporte de dos niveles: aviso simple + detalle técnico desplegable. */
export const construirReporte = (
  error: unknown,
  contexto: Contexto,
): ErrorReport => {
  const mensaje = aTexto(error);
  const lineas = [
    `Fecha: ${new Date().toISOString()}`,
    `Usuario: ${contexto.usuario ?? "sin sesión"}`,
    `Pantalla: ${contexto.pantalla}`,
    ...codigosDe(error),
    `Error: ${mensaje}`,
    ...(error instanceof Error && error.stack
      ? [`Stack:\n${error.stack}`]
      : []),
    ...(contexto.componentes ? [`Componentes:${contexto.componentes}`] : []),
  ];
  return {
    resumen: "Ocurrió un error inesperado.",
    detalle: lineas.join("\n"),
  };
};

/** Cancelaciones de petición y ruido de extensiones del navegador no son errores de la app. */
export const esRuidoIgnorable = (error: unknown, origen?: string): boolean => {
  const texto = aTexto(error);
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (/abort|ResizeObserver loop|Script error\.?$/i.test(texto)) return true;
  if (origen && /^(chrome|moz|safari)-extension:/.test(origen)) return true;
  return false;
};
