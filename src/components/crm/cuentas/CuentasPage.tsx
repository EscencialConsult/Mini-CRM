import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
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
import { SolicitudesPendientes } from "./SolicitudesPendientes";
import {
  CLAVE_SOLICITUDES,
  descartarSolicitud,
  useSolicitudes,
  type Solicitud,
} from "./useSolicitudes";

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
        // Con muchos módulos la lista se parte en líneas: si no, ensancha la tabla
        // y empuja el panel de solicitudes (y su «Dar de alta») fuera de la pantalla
        <span className="block max-w-md min-w-48 text-sm whitespace-normal">
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
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { solicitudes, etiquetas, recargar } = useSolicitudes();

  const descartar = async (solicitud: Solicitud) => {
    try {
      await descartarSolicitud(solicitud, etiquetas);
      await recargar();
      void queryClient.invalidateQueries({ queryKey: CLAVE_SOLICITUDES });
      notify("Solicitud descartada: el cliente sigue en Clientes", {
        type: "info",
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo descartar", {
        type: "error",
      });
    }
  };

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
        encabezado={
          <SolicitudesPendientes
            solicitudes={solicitudes}
            alDescartar={descartar}
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
      {ruta.mode === "create" && (
        <CuentaFormDialog
          onClose={cerrar}
          onSolicitudCerrada={() => {
            void recargar();
            void queryClient.invalidateQueries({ queryKey: CLAVE_SOLICITUDES });
          }}
        />
      )}
      {ruta.mode === "edit" && (
        <CuentaFormDialog key={ruta.id} id={ruta.id} onClose={cerrar} />
      )}
    </>
  );
};
