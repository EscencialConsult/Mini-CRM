import { Plus } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha, plural } from "../domain/format";
import { nombreModulo } from "../domain/modulos";
import type { Cuenta } from "../domain/types";
import { Pill } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { CuentaFormDialog } from "./CuentaFormDialog";

const ESTADOS = [
  { id: "true", name: "Activas" },
  { id: "false", name: "Suspendidas" },
];

const columnas: ColumnaLista<Cuenta>[] = [
  {
    id: "nombre",
    encabezado: "Cuenta",
    orden: "nombre",
    celda: (cuenta) => (
      <span className="block">
        {cuenta.nombre}
        <span className="block text-xs font-normal text-muted-foreground">
          {cuenta.titular
            ? `${cuenta.titular.nombre} ${cuenta.titular.apellido} · ${cuenta.titular.email}`
            : "Sin titular"}
        </span>
      </span>
    ),
  },
  {
    id: "usuarios",
    encabezado: "Usuarios",
    orden: "usuarios_activos",
    alinear: "derecha",
    etiquetaTarjeta: "Usuarios activos",
    celda: (cuenta) =>
      cuenta.max_usuarios === null
        ? plural(cuenta.usuarios_activos, "usuario", "usuarios")
        : `${cuenta.usuarios_activos} de ${cuenta.max_usuarios}`,
  },
  {
    id: "modulos",
    encabezado: "Módulos",
    etiquetaTarjeta: "Módulos",
    celda: (cuenta) =>
      cuenta.modulos.length ? (
        <span className="text-sm">
          {cuenta.modulos.map(nombreModulo).join(", ")}
        </span>
      ) : (
        <span className="text-destructive">Ninguno</span>
      ),
  },
  {
    id: "estado",
    encabezado: "Estado",
    orden: "activa",
    etiquetaTarjeta: "Estado",
    celda: (cuenta) => (
      <Pill tono={cuenta.activa ? "exito" : "neutro"}>
        {cuenta.activa ? "Activa" : "Suspendida"}
      </Pill>
    ),
  },
  {
    id: "alta",
    encabezado: "Alta",
    orden: "creada_en",
    etiquetaTarjeta: "Alta",
    celda: (cuenta) => formatFecha(cuenta.creada_en),
  },
];

/**
 * Cuentas del sistema (solo la plataforma): cada una es un cliente que contrata,
 * con su plan (módulos y máximo de usuarios) y su administrador titular, que
 * después crea a sus propios trabajadores desde «Usuarios».
 */
export const CuentasPage = () => {
  const ruta = useRecordRoute("cuentas");
  const cerrar = useCloseRecord("cuentas");

  return (
    <>
      <CrmList<Cuenta>
        resource="cuentas"
        titulo="Cuentas"
        sort={{ field: "nombre", order: "ASC" }}
        buscar="Buscar por cuenta o email del titular"
        filtros={
          <FilterSelect
            source="activa"
            etiqueta="Estado"
            opciones={ESTADOS}
            convertir={(id) => id === "true"}
          />
        }
        acciones={
          <Button asChild>
            <Link to="/cuentas/create">
              <Plus />
              Nueva cuenta
            </Link>
          </Button>
        }
        columnas={columnas}
        tituloFila={(cuenta) => cuenta.nombre}
        hrefDe={(cuenta) => `/cuentas/${cuenta.id}`}
        vacio="Todavía no hay cuentas. Creá la primera con “Nueva cuenta”."
      />
      {ruta.mode === "create" && <CuentaFormDialog onClose={cerrar} />}
      {ruta.mode === "edit" && (
        <CuentaFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
