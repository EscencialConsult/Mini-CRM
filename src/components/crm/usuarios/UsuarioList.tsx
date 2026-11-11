import { UserPlus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha } from "../domain/format";
import { ROLES } from "../domain/options";
import type { Usuario } from "../domain/types";
import { Pill, RolBadge } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";

const ESTADOS = [
  { id: "true", name: "Activos" },
  { id: "false", name: "Inactivos" },
];

const columnas: ColumnaLista<Usuario>[] = [
  {
    id: "nombre",
    encabezado: "Usuario",
    orden: "nombre",
    celda: (usuario) => (
      <span className="block">
        {usuario.nombre} {usuario.apellido}
        <span className="block text-xs font-normal text-muted-foreground">
          {usuario.email}
        </span>
      </span>
    ),
  },
  {
    id: "rol",
    encabezado: "Rol",
    orden: "rol",
    etiquetaTarjeta: "Rol",
    celda: (usuario) => <RolBadge rol={usuario.rol} />,
  },
  {
    id: "estado",
    encabezado: "Estado",
    orden: "activo",
    etiquetaTarjeta: "Estado",
    celda: (usuario) => (
      <Pill tono={usuario.activo ? "exito" : "neutro"}>
        {usuario.activo ? "Activo" : "Inactivo"}
      </Pill>
    ),
  },
  {
    id: "alta",
    encabezado: "Alta",
    orden: "creado_en",
    etiquetaTarjeta: "Alta",
    celda: (usuario) => formatFecha(usuario.creado_en),
  },
];

export const UsuarioList = () => (
  <CrmList<Usuario>
    resource="usuarios"
    titulo="Usuarios"
    sort={{ field: "nombre", order: "ASC" }}
    buscar="Buscar por nombre o email"
    filtros={
      <>
        <FilterSelect source="rol" etiqueta="Rol" opciones={ROLES} />
        <FilterSelect
          source="activo"
          etiqueta="Estado"
          opciones={ESTADOS}
          convertir={(id) => id === "true"}
        />
      </>
    }
    acciones={
      <Button asChild>
        <Link to="/usuarios/create">
          <UserPlus />
          Nuevo usuario
        </Link>
      </Button>
    }
    columnas={columnas}
    tituloFila={(usuario) => `${usuario.nombre} ${usuario.apellido}`}
    hrefDe={(usuario) => `/usuarios/${usuario.id}`}
    vacio="No hay usuarios."
  />
);
