import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { formatFecha, plural } from "../domain/format";
import { nombreModulo } from "../domain/modulos";
import { diasRestantes, estadoCuenta } from "../domain/prueba";
import type { Cuenta } from "../domain/types";
import { Pill } from "../shared/badges";
import { CrmList, type ColumnaLista } from "../shared/CrmList";
import { FilterSelect } from "../shared/ListControls";
import { useCloseRecord, useRecordRoute } from "../shared/useRecordRoute";
import { ConfirmarDosPasos } from "./ConfirmarDosPasos";
import { CuentaFormDialog } from "./CuentaFormDialog";
import { PruebasTerminadas } from "./PruebasTerminadas";
import { SolicitudesPendientes } from "./SolicitudesPendientes";
import {
  CLAVE_SOLICITUDES,
  descartarSolicitud,
  useSolicitudes,
  type Solicitud,
} from "./useSolicitudes";

const ESTADOS = [
  { id: "activa", name: "Activas" },
  { id: "en_prueba", name: "En prueba" },
  { id: "prueba_terminada", name: "Prueba terminada" },
  { id: "suspendida", name: "Suspendidas" },
];

const EstadoCuentaPill = ({ cuenta }: { cuenta: Cuenta }) => {
  const estado = estadoCuenta(cuenta);
  if (estado === "en_prueba") {
    const dias = diasRestantes(cuenta) ?? 1;
    return (
      <Pill tono="aviso">
        En prueba · vence en {plural(dias, "día", "días")}
      </Pill>
    );
  }
  if (estado === "prueba_terminada") {
    return <Pill tono="peligro">Prueba terminada</Pill>;
  }
  if (estado === "suspendida") return <Pill tono="neutro">Suspendida</Pill>;
  return <Pill tono="exito">Activa</Pill>;
};

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
    celda: (cuenta) => <EstadoCuentaPill cuenta={cuenta} />,
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
    <ConfirmarDosPasos>
      <CrmList<Cuenta>
        resource="cuentas"
        titulo="Cuentas"
        // El filtro «Estado» antes se guardaba como `activa`; con la clave nueva
        // se descarta ese valor viejo, que quedaba aplicado sin verse.
        storeKey="cuentas.listParams.v2"
        detalleDelError
        sort={{ field: "nombre", order: "ASC" }}
        buscar="Buscar por cuenta o email del titular"
        filtros={
          <FilterSelect source="estado" etiqueta="Estado" opciones={ESTADOS} />
        }
        encabezado={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada cuenta es una empresa que usa el sistema, con su plan y su
              administrador titular.
            </p>
            <SolicitudesPendientes
              solicitudes={solicitudes}
              alDescartar={descartar}
            />
            <PruebasTerminadas />
          </div>
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
    </ConfirmarDosPasos>
  );
};
