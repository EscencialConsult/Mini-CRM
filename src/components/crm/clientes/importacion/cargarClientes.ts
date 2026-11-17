import { getSupabaseClient } from "../../providers/supabase";
import {
  claveTelefono,
  normalizarTexto,
  type Existentes,
  type FilaRevisada,
} from "./interpretar";

const PAGINA = 1000;
const LOTE = 100;

/** Emails, teléfonos y documentos que ya hay en el CRM (los que el usuario puede ver). */
export const cargarExistentes = async (): Promise<Existentes> => {
  const existentes: Existentes = {
    emails: new Set(),
    telefonos: new Set(),
    documentos: new Set(),
  };
  const supabase = getSupabaseClient();
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("clientes")
      .select("email, telefono, documento")
      .order("id")
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    for (const fila of data ?? []) {
      if (fila.email) existentes.emails.add(String(fila.email).toLowerCase());
      const clave = claveTelefono(fila.telefono);
      if (clave) existentes.telefonos.add(clave);
      if (fila.documento) existentes.documentos.add(String(fila.documento));
    }
    if ((data?.length ?? 0) < PAGINA) return existentes;
  }
};

export interface OpcionesCarga {
  /** Canal para las filas que no traen uno propio. */
  canalPorDefecto: number | null;
  /** Canales del CRM (por nombre normalizado) para entender la columna «Canal». */
  canalesPorNombre: Map<string, number>;
  etiqueta: number | null;
  /** Solo el administrador elige; para el resto la base lo deja a su nombre. */
  asignadoA: string | null;
}

export interface ResultadoCarga {
  creados: number;
  /** Filas que la base rechazó, con el motivo. */
  fallidas: { fila: FilaRevisada; motivo: string }[];
}

const aRegistro = (fila: FilaRevisada, opciones: OpcionesCarga) => ({
  ...fila.cliente,
  estado: "activo",
  canal_id:
    (fila.canal &&
      opciones.canalesPorNombre.get(normalizarTexto(fila.canal))) ||
    opciones.canalPorDefecto,
  ...(opciones.etiqueta ? { etiquetas: [opciones.etiqueta] } : {}),
  ...(opciones.asignadoA ? { asignado_a: opciones.asignadoA } : {}),
});

/**
 * Inserta las filas nuevas en lotes. Si un lote falla se reintenta fila por
 * fila, para que una sola mala no tire a las demás y cada rechazo tenga su motivo.
 */
export const cargarClientes = async (
  filas: FilaRevisada[],
  opciones: OpcionesCarga,
  alAvanzar: (hechas: number) => void,
): Promise<ResultadoCarga> => {
  const supabase = getSupabaseClient();
  const resultado: ResultadoCarga = { creados: 0, fallidas: [] };
  let hechas = 0;

  for (let desde = 0; desde < filas.length; desde += LOTE) {
    const lote = filas.slice(desde, desde + LOTE);
    const { error } = await supabase
      .from("clientes")
      .insert(lote.map((fila) => aRegistro(fila, opciones)));
    if (!error) {
      resultado.creados += lote.length;
    } else {
      for (const fila of lote) {
        const { error: errorFila } = await supabase
          .from("clientes")
          .insert(aRegistro(fila, opciones));
        if (errorFila) {
          resultado.fallidas.push({ fila, motivo: errorFila.message });
        } else {
          resultado.creados += 1;
        }
      }
    }
    hechas += lote.length;
    alAvanzar(hechas);
  }
  return resultado;
};
