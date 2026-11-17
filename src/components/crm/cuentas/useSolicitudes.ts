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
}

interface EtiquetasDeAlta {
  pendiente: number | null;
  activa: number | null;
}

const ETIQUETA_PENDIENTE = "solicitoprueba";
const ETIQUETA_ACTIVA = "pruebaactiva";

/** El envío de la landing deja «Empresa: X» en la nota (el rótulo del campo). */
const leerEmpresa = (nota: string | null): string => {
  const linea = (nota ?? "")
    .split("\n")
    .find((texto) => /^empresa\s*:/i.test(texto.trim()));
  return linea ? linea.slice(linea.indexOf(":") + 1).trim() : "";
};

/** Solicitudes de prueba pendientes: clientes con la etiqueta «Solicitó prueba». */
export const useSolicitudes = () => {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetasDeAlta>({
    pendiente: null,
    activa: null,
  });
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const supabase = getSupabaseClient();
      const { data: todas } = await supabase
        .from("etiquetas")
        .select("id, nombre");
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
      const { data: clientes } = await supabase
        .from("clientes")
        .select(
          "id, nombre, apellido, razon_social, email, telefono, etiquetas, creado_en",
        )
        .contains("etiquetas", [pendiente])
        .order("creado_en", { ascending: false })
        .limit(50);
      const ids = (clientes ?? []).map((cliente) => cliente.id as number);
      const empresas = new Map<number, string>();
      if (ids.length) {
        const { data: notas } = await supabase
          .from("actividades")
          .select("cliente_id, descripcion, creado_en")
          .in("cliente_id", ids)
          .eq("tipo", "nota")
          .ilike("titulo", "Formulario de la landing%")
          .order("creado_en", { ascending: false });
        for (const nota of notas ?? []) {
          const id = nota.cliente_id as number;
          if (!empresas.has(id))
            empresas.set(id, leerEmpresa(nota.descripcion));
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
        })),
      );
    } catch (error) {
      console.error("cuentas.solicitudes_fallidas", error);
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { solicitudes, etiquetas, cargando, recargar: cargar };
};

/**
 * Cuando se crea la cuenta: el cliente deja de estar «Solicitó prueba» y pasa a
 * «Prueba activa», y sus tareas pendientes (la del alta) quedan hechas.
 */
export const marcarAltaHecha = async (
  solicitud: Solicitud,
  etiquetas: EtiquetasDeAlta,
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
