import { Download } from "lucide-react";
import { downloadCSV, useListContext, useNotify } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { formatFecha, formatMoneda, hoyIso } from "../domain/format";
import type { Oportunidad } from "../domain/types";
import { useModulos } from "../providers/authProvider";
import { CrmList, type ColumnaLista } from "../shared/CrmList";

const columnas: ColumnaLista<Oportunidad>[] = [
  {
    id: "producto",
    encabezado: "Venta",
    orden: "producto_servicio",
    celda: (venta) => venta.producto_servicio,
  },
  {
    id: "cliente",
    encabezado: "Cliente",
    orden: "cliente_nombre",
    etiquetaTarjeta: "Cliente",
    celda: (venta) => venta.cliente_nombre,
  },
  {
    id: "cierre",
    encabezado: "Cierre",
    orden: "fecha_cierre",
    etiquetaTarjeta: "Cierre",
    celda: (venta) => formatFecha(venta.fecha_cierre),
  },
  {
    id: "canal",
    encabezado: "Canal",
    orden: "canal_nombre",
    etiquetaTarjeta: "Canal",
    celda: (venta) => venta.canal_nombre ?? "—",
  },
  {
    id: "responsables",
    encabezado: "Responsables",
    orden: "asignado_nombre",
    etiquetaTarjeta: "Responsables",
    celda: (venta) => venta.asignado_nombre ?? "Sin asignar",
  },
  {
    id: "importe",
    encabezado: "Importe",
    orden: "importe_estimado",
    alinear: "derecha",
    etiquetaTarjeta: "Importe",
    celda: (venta) => formatMoneda(venta.importe_estimado),
  },
];

// Excel en español abre bien el CSV con punto y coma y coma decimal
const SEPARADOR = ";";

const celdaCsv = (valor: unknown): string => {
  const texto =
    typeof valor === "number"
      ? String(valor).replace(".", ",")
      : String(valor ?? "");
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const COLUMNAS_CSV: [string, (venta: Oportunidad) => unknown][] = [
  ["Fecha de cierre", (venta) => venta.fecha_cierre],
  ["Cliente", (venta) => venta.cliente_nombre],
  [
    "Productos",
    (venta) =>
      (venta.productos ?? [])
        .map(
          (linea) =>
            `${linea.cantidad} x ${linea.nombre ?? "Producto"}${
              linea.descuento ? ` (-${linea.descuento} %)` : ""
            }`,
        )
        .join(" | "),
  ],
  ["Importe", (venta) => Number(venta.importe_estimado)],
  ["Canal", (venta) => venta.canal_nombre],
  ["Responsables", (venta) => venta.asignado_nombre],
  ["Fecha de alta", (venta) => venta.creado_en?.slice(0, 10)],
];

const aCsv = (ventas: Oportunidad[]): string =>
  [
    COLUMNAS_CSV.map(([titulo]) => titulo).join(SEPARADOR),
    ...ventas.map((venta) =>
      COLUMNAS_CSV.map(([, valor]) => celdaCsv(valor(venta))).join(SEPARADOR),
    ),
  ].join("\r\n");

const MAXIMO_EXPORTADO = 5000;

/** Descarga las ventas del listado (con filtros, búsqueda y orden) en CSV. */
const ExportarCsv = () => {
  const { getData, total } = useListContext<Oportunidad>();
  const notify = useNotify();
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    if (!getData) return;
    setExportando(true);
    try {
      const ventas = await getData({ maxResults: MAXIMO_EXPORTADO });
      downloadCSV(aCsv(ventas), `ventas-${hoyIso()}`);
    } catch {
      notify("No se pudo exportar el listado", { type: "error" });
    } finally {
      setExportando(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      loading={exportando}
      disabled={!total}
      onClick={() => void exportar()}
    >
      <Download />
      Exportar CSV
    </Button>
  );
};

/** Ventas ganadas con los filtros de la sección; se abren en el Tablero. */
export const VentasListado = ({
  filtro,
}: {
  filtro: Record<string, unknown>;
}) => {
  const { tiene } = useModulos();

  return (
    <CrmList<Oportunidad>
      resource="ventas"
      sort={{ field: "fecha_cierre", order: "DESC" }}
      filter={filtro}
      buscar="Buscar por producto o cliente"
      acciones={<ExportarCsv />}
      columnas={columnas}
      tituloFila={(venta) => venta.producto_servicio}
      // Sin Tablero no se edita: la fila no abre nada
      hrefDe={
        tiene("oportunidades")
          ? (venta) => `/oportunidades/${venta.id}`
          : undefined
      }
      vacio="No hay ventas ganadas con estos filtros."
    />
  );
};
