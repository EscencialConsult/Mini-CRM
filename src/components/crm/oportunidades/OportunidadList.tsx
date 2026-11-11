import { Plus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha, formatMoneda } from "../domain/format";
import { ETAPAS, RESULTADOS } from "../domain/options";
import type { Oportunidad } from "../domain/types";
import { useCrmIdentity } from "../providers/authProvider";
import { EtapaBadge, ResultadoBadge } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { useUsuarios } from "../shared/useUsuarios";

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
    id: "responsable",
    encabezado: "Responsable",
    orden: "asignado_nombre",
    etiquetaTarjeta: "Responsable",
    celda: (oportunidad) => oportunidad.asignado_nombre ?? "Sin asignar",
  },
];

export const OportunidadList = () => {
  const { identity } = useCrmIdentity();
  const { opcionesTodas } = useUsuarios();
  const opcionesResponsable = opcionesTodas.map((opcion) =>
    opcion.id === identity?.id
      ? { ...opcion, name: `${opcion.name} (yo)` }
      : opcion,
  );

  return (
    <CrmList<Oportunidad>
      resource="oportunidades"
      titulo="Oportunidades"
      sort={{ field: "creado_en", order: "DESC" }}
      filterDefaultValues={{ resultado: "abierta" }}
      buscar="Buscar por producto o cliente"
      filtros={
        <>
          <FilterSelect
            source="resultado"
            etiqueta="Resultado"
            opciones={RESULTADOS}
            todas="Todas"
          />
          <FilterSelect source="etapa" etiqueta="Etapa" opciones={ETAPAS} />
          <FilterSelect
            source="asignado_a"
            etiqueta="Responsable"
            opciones={opcionesResponsable}
          />
        </>
      }
      acciones={
        <Button asChild>
          <Link to="/oportunidades/create">
            <Plus />
            Nueva oportunidad
          </Link>
        </Button>
      }
      columnas={columnas}
      tituloFila={(oportunidad) => oportunidad.producto_servicio}
      hrefDe={(oportunidad) => `/oportunidades/${oportunidad.id}`}
      vacio="Todavía no hay oportunidades. Registrá la primera con “Nueva oportunidad”."
    />
  );
};
