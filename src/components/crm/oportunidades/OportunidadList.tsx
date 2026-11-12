import { formatFecha, formatMoneda } from "../domain/format";
import { ETAPAS, RESULTADOS } from "../domain/options";
import type { Oportunidad } from "../domain/types";
import { EtapaBadge, ResultadoBadge } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect, FiltroSoloEmpresas } from "../shared/ListControls";
import {
  AccionesOportunidades,
  FiltroCanal,
  FiltroResponsable,
} from "./ControlesOportunidades";
import {
  BUSCAR_OPORTUNIDADES,
  FILTROS_INICIALES_OPORTUNIDADES,
} from "./vistaOportunidades";

const columnas: ColumnaLista<Oportunidad>[] = [
  {
    id: "producto",
    encabezado: "Producto o servicio",
    orden: "producto_servicio",
    celda: (oportunidad) => oportunidad.producto_servicio,
  },
  {
    id: "cliente",
    encabezado: "Cliente",
    orden: "cliente_nombre",
    etiquetaTarjeta: "Cliente",
    celda: (oportunidad) => oportunidad.cliente_nombre,
  },
  {
    id: "importe",
    encabezado: "Importe",
    orden: "importe_estimado",
    alinear: "derecha",
    etiquetaTarjeta: "Importe",
    celda: (oportunidad) => formatMoneda(oportunidad.importe_estimado),
  },
  {
    id: "etapa",
    encabezado: "Etapa",
    orden: "etapa",
    etiquetaTarjeta: "Etapa",
    celda: (oportunidad) => <EtapaBadge etapa={oportunidad.etapa} />,
  },
  {
    id: "probabilidad",
    encabezado: "Prob.",
    orden: "probabilidad",
    alinear: "derecha",
    etiquetaTarjeta: "Probabilidad",
    celda: (oportunidad) => `${oportunidad.probabilidad} %`,
  },
  {
    id: "resultado",
    encabezado: "Resultado",
    orden: "resultado",
    etiquetaTarjeta: "Resultado",
    celda: (oportunidad) => (
      <ResultadoBadge resultado={oportunidad.resultado} />
    ),
  },
  {
    id: "cierre",
    encabezado: "Cierre",
    orden: "fecha_cierre_estimada",
    etiquetaTarjeta: "Cierre",
    celda: (oportunidad) =>
      oportunidad.fecha_cierre
        ? formatFecha(oportunidad.fecha_cierre)
        : oportunidad.fecha_cierre_estimada
          ? `Est. ${formatFecha(oportunidad.fecha_cierre_estimada)}`
          : "—",
  },
  {
    id: "canal",
    encabezado: "Canal",
    orden: "canal_nombre",
    etiquetaTarjeta: "Canal",
    celda: (oportunidad) => oportunidad.canal_nombre ?? "—",
  },
  {
    id: "responsable",
    encabezado: "Responsables",
    orden: "asignado_nombre",
    etiquetaTarjeta: "Responsables",
    celda: (oportunidad) => oportunidad.asignado_nombre ?? "Sin asignar",
  },
];

export const OportunidadList = () => (
  <CrmList<Oportunidad>
    resource="oportunidades"
    titulo="Tablero"
    sort={{ field: "creado_en", order: "DESC" }}
    filterDefaultValues={FILTROS_INICIALES_OPORTUNIDADES}
    buscar={BUSCAR_OPORTUNIDADES}
    filtros={
      <>
        <FilterSelect
          source="resultado"
          etiqueta="Resultado"
          opciones={RESULTADOS}
          todas="Todas"
        />
        <FilterSelect source="etapa" etiqueta="Etapa" opciones={ETAPAS} />
        <FiltroResponsable />
        <FiltroCanal />
        <FiltroSoloEmpresas />
      </>
    }
    acciones={<AccionesOportunidades />}
    columnas={columnas}
    tituloFila={(oportunidad) => oportunidad.producto_servicio}
    hrefDe={(oportunidad) => `/oportunidades/${oportunidad.id}`}
    vacio="Todavía no hay oportunidades. Registrá la primera con “Nueva oportunidad”."
  />
);
