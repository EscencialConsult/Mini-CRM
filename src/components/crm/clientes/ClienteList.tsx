import { Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ESTADOS_CLIENTE, TIPOS_CLIENTE, nombreDe } from "../domain/options";
import {
  etiquetaDocumento,
  formatDocumento,
  formatFecha,
  formatMoneda,
  hoyIso,
} from "../domain/format";
import type { Cliente, Landing } from "../domain/types";
import { EtiquetasCliente } from "../etiquetas/EtiquetaChip";
import { useEtiquetas } from "../etiquetas/useEtiquetas";
import { useCrmIdentity } from "../providers/authProvider";
import { EstadoClienteBadge } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { useUsuarios } from "../shared/useUsuarios";

const ProximoContacto = ({ cliente }: { cliente: Cliente }) => {
  if (!cliente.proximo_contacto)
    return <span className="text-muted-foreground">—</span>;
  const vencido =
    cliente.estado === "activo" && cliente.proximo_contacto < hoyIso();
  return (
    <span className={cn(vencido && "font-medium text-destructive")}>
      {formatFecha(cliente.proximo_contacto)}
      {vencido && " · vencido"}
    </span>
  );
};

const columnas: ColumnaLista<Cliente>[] = [
  {
    id: "nombre",
    encabezado: "Cliente",
    orden: "nombre_completo",
    celda: (cliente) => (
      <span className="block">
        {cliente.nombre_completo}
        {cliente.documento && (
          <span className="block text-xs font-normal text-muted-foreground">
            {etiquetaDocumento(cliente.documento)}{" "}
            {formatDocumento(cliente.documento)}
          </span>
        )}
      </span>
    ),
  },
  {
    id: "etiquetas",
    encabezado: "Etiquetas",
    etiquetaTarjeta: "Etiquetas",
    celda: (cliente) =>
      cliente.etiquetas?.length ? (
        <EtiquetasCliente ids={cliente.etiquetas} maximo={2} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "tipo",
    encabezado: "Tipo",
    orden: "tipo",
    etiquetaTarjeta: "Tipo",
    celda: (cliente) => nombreDe(TIPOS_CLIENTE, cliente.tipo),
  },
  {
    id: "contacto",
    encabezado: "Contacto",
    etiquetaTarjeta: "Contacto",
    celda: (cliente) =>
      cliente.telefono || cliente.email ? (
        <span className="block truncate">
          {cliente.telefono}
          {cliente.telefono && cliente.email && (
            <span className="block text-xs text-muted-foreground">
              {cliente.email}
            </span>
          )}
          {!cliente.telefono && cliente.email}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "estado",
    encabezado: "Estado",
    orden: "estado",
    etiquetaTarjeta: "Estado",
    celda: (cliente) => <EstadoClienteBadge estado={cliente.estado} />,
  },
  {
    id: "asignado",
    encabezado: "Vendedor",
    orden: "asignado_nombre",
    etiquetaTarjeta: "Vendedor",
    celda: (cliente) =>
      cliente.asignado_nombre ?? (
        <span className="text-muted-foreground">Sin asignar</span>
      ),
  },
  {
    id: "proximo_contacto",
    encabezado: "Próx. contacto",
    orden: "proximo_contacto",
    etiquetaTarjeta: "Próximo contacto",
    celda: (cliente) => <ProximoContacto cliente={cliente} />,
  },
  {
    id: "oportunidades",
    encabezado: "Oport. abiertas",
    orden: "oportunidades_abiertas",
    alinear: "derecha",
    etiquetaTarjeta: "Oportunidades abiertas",
    celda: (cliente) =>
      cliente.oportunidades_abiertas ? (
        <span>
          {cliente.oportunidades_abiertas}
          <span className="block text-xs text-muted-foreground">
            {formatMoneda(cliente.importe_abierto)}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
];

const CINCO_MINUTOS = 5 * 60 * 1000;

/** Landings para filtrar por origen: solo id y nombre, pedidas una vez. */
const useOpcionesLanding = () => {
  const { data = [] } = useGetList<Landing>(
    "landings",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "nombre", order: "ASC" },
      meta: { columns: ["id", "nombre"] },
    },
    { staleTime: CINCO_MINUTOS },
  );
  return data.map((landing) => ({
    id: String(landing.id),
    name: landing.nombre,
  }));
};

export const ClienteList = () => {
  const { identity } = useCrmIdentity();
  const { opcionesTodas } = useUsuarios();
  const opcionesLanding = useOpcionesLanding();
  const { etiquetas } = useEtiquetas();
  const opcionesEtiqueta = etiquetas.map((etiqueta) => ({
    id: String(etiqueta.id),
    name: etiqueta.nombre,
  }));

  const opcionesVendedor = opcionesTodas.map((opcion) =>
    opcion.id === identity?.id
      ? { ...opcion, name: `${opcion.name} (yo)` }
      : opcion,
  );

  return (
    <CrmList<Cliente>
      resource="clientes"
      titulo="Clientes"
      sort={{ field: "nombre_completo", order: "ASC" }}
      buscar="Buscar por nombre, documento, email, teléfono o etiqueta"
      filtros={
        <>
          <FilterSelect
            source="estado"
            etiqueta="Estado"
            opciones={ESTADOS_CLIENTE}
          />
          <FilterSelect
            source="tipo"
            etiqueta="Tipo"
            opciones={TIPOS_CLIENTE}
          />
          <FilterSelect
            source="asignado_a"
            etiqueta="Vendedor"
            opciones={opcionesVendedor}
          />
          {opcionesEtiqueta.length > 0 && (
            <FilterSelect
              source="etiquetas"
              etiqueta="Etiqueta"
              opciones={opcionesEtiqueta}
              todas="Todas"
              convertir={Number}
            />
          )}
          {opcionesLanding.length > 0 && (
            <FilterSelect
              source="landing_id"
              etiqueta="Landing"
              opciones={opcionesLanding}
              todas="Todas"
              convertir={Number}
            />
          )}
        </>
      }
      acciones={
        <Button asChild>
          <Link to="/clientes/create">
            <Plus />
            Nuevo cliente
          </Link>
        </Button>
      }
      columnas={columnas}
      tituloFila={(cliente) => cliente.nombre_completo}
      hrefDe={(cliente) => `/clientes/${cliente.id}`}
      vacio="Todavía no hay clientes. Creá el primero con “Nuevo cliente”."
    />
  );
};
