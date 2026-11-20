import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { normalizarTexto } from "../clientes/importacion/interpretar";
import { getSupabaseClient } from "../providers/supabase";

/** Ruta del alta con la solicitud ya elegida. */
export const rutaAltaDesde = (clienteId: number) =>
  `/cuentas/create?solicitud=${clienteId}`;

/** Quien pidió la prueba desde la landing y todavía no tiene cuenta. */
export interface Solicitud {
  clienteId: number;
  nombre: string;
  apellido: string;
  /** Lo que escribió en «Empresa» (queda en la nota del envío); vacío si no hay. */
  empresa: string;
  email: string;
  telefono: string;
  etiquetas: number[];
  creadoEn: string;
  /**
   * El último envío coincidió con un cliente ya cargado: nombre, email y
   * teléfono de arriba son los de la ficha vieja, no los del envío.
   */
  envioFusionado?: { datos: string };
}

interface EtiquetasDeAlta {
  pendiente: number | null;
  activa: number | null;
}

const ETIQUETA_PENDIENTE = "solicitoprueba";
const ETIQUETA_ACTIVA = "pruebaactiva";

/** Cuántas solicitudes trae la lista como máximo. */
export const LIMITE_SOLICITUDES = 50;

const ROTULO_EMPRESA = /empresa|negocio|razonsocial|compania/;

/**
 * El envío de la landing deja «Rótulo: valor» en la nota. Se toma la primera
 * línea cuyo rótulo menciona empresa, negocio, razón social o compañía.
 */
const leerEmpresa = (nota: string | null): string => {
  for (const texto of (nota ?? "").split("\n")) {
    const corte = texto.indexOf(":");
    if (corte < 0) continue;
    if (ROTULO_EMPRESA.test(normalizarTexto(texto.slice(0, corte)))) {
      return texto.slice(corte + 1).trim();
    }
  }
  return "";
};

const MARCA_FUSION = "este envío coincidió con un cliente ya cargado";
const ROTULO_DATOS = "datos que dejó en el envío:";

/**
 * Si la nota avisa que el envío se sumó a una ficha existente, devuelve los
 * datos que dejó en el envío (vacío si la línea no está); si no, undefined.
 */
const leerFusion = (nota: string | null): { datos: string } | undefined => {
  const lineas = (nota ?? "").split("\n").map((linea) => linea.trim());
  if (!lineas.some((linea) => linea.toLowerCase().startsWith(MARCA_FUSION))) {
    return undefined;
  }
  const linea = lineas.find((texto) =>
    texto.toLowerCase().startsWith(ROTULO_DATOS),
  );
  return { datos: linea ? linea.slice(ROTULO_DATOS.length).trim() : "" };
};

/** Solicitudes de prueba pendientes: clientes con la etiqueta «Solicitó prueba». */
export const useSolicitudes = () => {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetasDeAlta>({
    pendiente: null,
    activa: null,
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const supabase = getSupabaseClient();
      const { data: todas, error: errorEtiquetas } = await supabase
        .from("etiquetas")
        .select("id, nombre");
      if (errorEtiquetas) throw new Error(errorEtiquetas.message);
      const idDe = (clave: string) =>
        (todas ?? []).find(
          (fila) => normalizarTexto(String(fila.nombre)) === clave,
        )?.id as number | undefined;
      const pendiente = idDe(ETIQUETA_PENDIENTE) ?? null;
      setEtiquetas({ pendiente, activa: idDe(ETIQUETA_ACTIVA) ?? null });
      if (pendiente === null) {
        setSolicitudes([]);
        return;
      }
      const { data: clientes, error: errorClientes } = await supabase
        .from("clientes")
        .select(
          "id, nombre, apellido, razon_social, email, telefono, etiquetas, creado_en",
        )
        .contains("etiquetas", [pendiente])
        .order("creado_en", { ascending: false })
        .limit(LIMITE_SOLICITUDES);
      if (errorClientes) throw new Error(errorClientes.message);
      const ids = (clientes ?? []).map((cliente) => cliente.id as number);
      const empresas = new Map<number, string>();
      const fusiones = new Map<number, { datos: string }>();
      if (ids.length) {
        const { data: notas, error: errorNotas } = await supabase
          .from("actividades")
          .select("cliente_id, descripcion, creado_en")
          .in("cliente_id", ids)
          .eq("tipo", "nota")
          .or(
            "titulo.ilike.Formulario de la landing%,titulo.ilike.WhatsApp desde la landing%",
          )
          .order("creado_en", { ascending: false });
        if (errorNotas) console.error("cuentas.notas_fallidas", errorNotas);
        const vistos = new Set<number>();
        for (const nota of notas ?? []) {
          const id = nota.cliente_id as number;
          if (vistos.has(id)) continue;
          vistos.add(id);
          empresas.set(id, leerEmpresa(nota.descripcion));
          const fusion = leerFusion(nota.descripcion);
          if (fusion) fusiones.set(id, fusion);
        }
      }
      setSolicitudes(
        (clientes ?? []).map((cliente) => ({
          clienteId: cliente.id as number,
          nombre: cliente.nombre ?? "",
          apellido: cliente.apellido ?? "",
          empresa:
            empresas.get(cliente.id as number) || (cliente.razon_social ?? ""),
          email: cliente.email ?? "",
          telefono: cliente.telefono ?? "",
          etiquetas: (cliente.etiquetas as number[] | null) ?? [],
          creadoEn: cliente.creado_en as string,
          envioFusionado: fusiones.get(cliente.id as number),
        })),
      );
    } catch (error) {
      console.error("cuentas.solicitudes_fallidas", error);
      setSolicitudes([]);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return {
    solicitudes,
    etiquetas,
    cargando,
    recargar: cargar,
    error,
    faltaEtiqueta: !cargando && !error && etiquetas.pendiente === null,
  };
};

/** Deja constancia en el historial del cliente; es un extra: si falla, no se corta nada. */
const dejarNota = async (clienteId: number, titulo: string) => {
  const { error } = await getSupabaseClient()
    .from("actividades")
    .insert({ tipo: "nota", cliente_id: clienteId, titulo });
  if (error) console.error("cuentas.nota_fallida", error);
};

/**
 * Cuando se crea la cuenta: el cliente deja de estar «Solicitó prueba» y pasa a
 * «Prueba activa», y sus tareas pendientes (la del alta) quedan hechas.
 */
export const marcarAltaHecha = async (
  solicitud: Solicitud,
  etiquetas: EtiquetasDeAlta,
  cuenta?: string,
) => {
  const supabase = getSupabaseClient();
  const nuevas = solicitud.etiquetas.filter((id) => id !== etiquetas.pendiente);
  if (etiquetas.activa !== null && !nuevas.includes(etiquetas.activa)) {
    nuevas.push(etiquetas.activa);
  }
  const { error } = await supabase
    .from("clientes")
    .update({ etiquetas: nuevas })
    .eq("id", solicitud.clienteId);
  if (error) throw new Error(error.message);
  const { error: errorTareas } = await supabase
    .from("actividades")
    .update({ completada: true })
    .eq("cliente_id", solicitud.clienteId)
    .eq("tipo", "tarea")
    .eq("completada", false);
  if (errorTareas) throw new Error(errorTareas.message);
  await dejarNota(
    solicitud.clienteId,
    cuenta ? `Cuenta creada: ${cuenta}` : "Cuenta creada desde la solicitud",
  );
};

/**
 * Una solicitud que no corresponde (repetida, de prueba, de alguien que no
 * va a seguir): sale del panel. El cliente queda en Clientes, sin la etiqueta.
 */
export const descartarSolicitud = async (
  solicitud: Solicitud,
  etiquetas: EtiquetasDeAlta,
) => {
  const { error } = await getSupabaseClient()
    .from("clientes")
    .update({
      etiquetas: solicitud.etiquetas.filter((id) => id !== etiquetas.pendiente),
    })
    .eq("id", solicitud.clienteId);
  if (error) throw new Error(error.message);
  await dejarNota(solicitud.clienteId, "Solicitud de prueba descartada");
};

/** Clave de las consultas de solicitudes: se invalida al dar de alta una. */
export const CLAVE_SOLICITUDES = ["solicitudes-pendientes"] as const;

const idEtiquetaPendiente = async (): Promise<number | null> => {
  const { data } = await getSupabaseClient()
    .from("etiquetas")
    .select("id, nombre");
  const fila = (data ?? []).find(
    (etiqueta) =>
      normalizarTexto(String(etiqueta.nombre)) === ETIQUETA_PENDIENTE,
  );
  return (fila?.id as number | undefined) ?? null;
};

/** Cuántas solicitudes esperan alta (para el aviso del menú). Solo la plataforma. */
export const useConteoSolicitudes = (activo: boolean): number =>
  useQuery({
    queryKey: [...CLAVE_SOLICITUDES, "conteo"],
    enabled: activo,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const etiqueta = await idEtiquetaPendiente();
      if (etiqueta === null) return 0;
      const { count } = await getSupabaseClient()
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .contains("etiquetas", [etiqueta]);
      return count ?? 0;
    },
  }).data ?? 0;

/** ¿Este cliente es una solicitud de prueba que todavía no tiene cuenta? */
export const useEsSolicitudPendiente = (
  etiquetas: number[] | undefined,
  activo: boolean,
): boolean => {
  const { data } = useQuery({
    queryKey: [...CLAVE_SOLICITUDES, "etiqueta"],
    enabled: activo,
    staleTime: 5 * 60_000,
    queryFn: idEtiquetaPendiente,
  });
  return data != null && !!etiquetas?.includes(data);
};
