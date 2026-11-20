import { UserPlus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha } from "../domain/format";
import { nombreModulo } from "../domain/modulos";
import { ROLES } from "../domain/options";
import type { Usuario } from "../domain/types";
import { useCrmIdentity } from "../providers/authProvider";
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
    id: "modulos",
    encabezado: "Módulos",
    etiquetaTarjeta: "Módulos",
    celda: (usuario) =>
      usuario.rol === "administrador" ? (
        <span className="text-muted-foreground">Todos</span>
      ) : usuario.modulos.length ? (
        <span className="text-sm">
          {usuario.modulos.map(nombreModulo).join(", ")}
        </span>
      ) : (
        <span className="text-destructive">Ninguno</span>
      ),
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

/**
 * Solo para el dueño de la plataforma: los usuarios que crea acá son de SU cuenta
 * (ven su catálogo y sus clientes). Una empresa cliente se crea en Cuentas y es
 * su titular quien da de alta a sus empleados.
 */
const AvisoPlataforma = () => {
  const { identity } = useCrmIdentity();
  if (identity?.plataforma !== true) return null;
  const empresa = identity.cuenta?.nombre;
  return (
    <p
      role="note"
      className="break-words rounded-lg border border-border bg-muted px-4 py-3 text-sm"
    >
      Estas personas pertenecen a tu propia empresa
      {empresa ? ` («${empresa}»)` : ""}: ven sus clientes y su catálogo. Para
      una empresa cliente, creala en{" "}
      <Link
        to="/cuentas"
        className="rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Cuentas
      </Link>
      . Su titular da de alta a sus empleados desde el menú Usuarios.
    </p>
  );
};

export const UsuarioList = () => (
  <CrmList<Usuario>
    resource="usuarios"
    titulo="Usuarios"
    encabezado={<AvisoPlataforma />}
    sort={{ field: "nombre", order: "ASC" }}
    // El "Bot WhatsApp" es un usuario del sistema: no se gestiona desde acá
    filter={{ sistema: false }}
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
