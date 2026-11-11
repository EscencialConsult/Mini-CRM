import { EditBase, useNotify, useRecordContext, useUpdate } from "ra-core";
import { UserRoundCheck, UserRoundX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { etiquetaDocumento, formatDocumento } from "../domain/format";
import { nombreDe, TIPOS_CLIENTE } from "../domain/options";
import type { Cliente } from "../domain/types";
import { useEsAdministrador } from "../providers/authProvider";
import { AutoriaInfo } from "../shared/AutoriaInfo";
import { EstadoClienteBadge } from "../shared/badges";
import { DeleteRecordButton } from "../shared/DeleteRecordButton";
import { RecordDialog } from "../shared/RecordDialog";
import { DialogoCargando } from "../shared/RecordFormDialog";
import { RecordForm } from "../shared/RecordForm";
import { useAvisoGuardado } from "../shared/useAvisoGuardado";
import { useRefrescarDatos } from "../shared/useRefrescarDatos";
import {
  ClienteActividades,
  ClienteHistorial,
  ClienteOportunidades,
} from "./ClienteRelacionados";
import { ClienteInputs } from "./ClienteInputs";
import { ClienteAvatar, ClienteResumen } from "./ClienteResumen";

/** Baja lógica: el cliente pasa a inactivo (o vuelve a activo) sin perder su historial. */
const CambiarEstadoButton = ({ cliente }: { cliente: Cliente }) => {
  const [actualizar, { isPending }] = useUpdate();
  const notify = useNotify();
  const refrescar = useRefrescarDatos();
  const activo = cliente.estado === "activo";

  const alternar = async () => {
    try {
      await actualizar(
        "clientes",
        {
          id: cliente.id,
          data: { estado: activo ? "inactivo" : "activo" },
          previousData: cliente,
        },
        { returnPromise: true, mutationMode: "pessimistic" },
      );
      notify(
        activo ? "Cliente dado de baja (inactivo)" : "Cliente reactivado",
        {
          type: "success",
        },
      );
      void refrescar();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo cambiar el estado",
        { type: "error" },
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={isPending}
      onClick={alternar}
    >
      {activo ? <UserRoundX /> : <UserRoundCheck />}
      {activo ? "Dar de baja" : "Reactivar"}
    </Button>
  );
};

/** Las pestañas sin formulario scrollean solas (Datos lo hace su RecordForm, con el pie fijo). */
const PESTANA_CON_SCROLL = "min-h-0 overflow-y-auto";

const Contenido = ({ onClose }: { onClose: () => void }) => {
  const cliente = useRecordContext<Cliente>();
  const esAdministrador = useEsAdministrador();
  if (!cliente) return null;

  return (
    <RecordDialog
      title={
        <span className="flex flex-wrap items-center gap-2">
          {cliente.nombre_completo}
          <EstadoClienteBadge estado={cliente.estado} />
        </span>
      }
      description={[
        nombreDe(TIPOS_CLIENTE, cliente.tipo),
        cliente.documento &&
          `${etiquetaDocumento(cliente.documento)} ${formatDocumento(cliente.documento)}`,
      ]
        .filter(Boolean)
        .join(" · ")}
      icon={<ClienteAvatar cliente={cliente} />}
      summary={<ClienteResumen cliente={cliente} />}
      size="xl"
      onClose={onClose}
      headerActions={<CambiarEstadoButton cliente={cliente} />}
    >
      <Tabs defaultValue="datos" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-6 mt-4 w-fit max-w-[calc(100%-3rem)] overflow-x-auto">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="actividades">Tareas</TabsTrigger>
          {esAdministrador && (
            <TabsTrigger value="historial">Historial</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="datos" className="flex min-h-0 flex-col">
          <RecordForm
            onCancel={onClose}
            footerActions={
              esAdministrador && (
                <DeleteRecordButton
                  resource="clientes"
                  id={cliente.id}
                  previousData={cliente}
                  descripcion={`al cliente ${cliente.nombre_completo}`}
                  consecuencia="También se eliminan todas sus oportunidades y tareas."
                  onDeleted={onClose}
                />
              )
            }
            footerInfo={
              <AutoriaInfo
                {...cliente}
                creado_desde={
                  cliente.landing_nombre
                    ? `la landing «${cliente.landing_nombre}»`
                    : null
                }
              />
            }
          >
            <ClienteInputs />
          </RecordForm>
        </TabsContent>
        <TabsContent value="oportunidades" className={PESTANA_CON_SCROLL}>
          <ClienteOportunidades clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="actividades" className={PESTANA_CON_SCROLL}>
          <ClienteActividades clienteId={cliente.id} />
        </TabsContent>
        {esAdministrador && (
          <TabsContent value="historial" className={PESTANA_CON_SCROLL}>
            <ClienteHistorial clienteId={cliente.id} />
          </TabsContent>
        )}
      </Tabs>
    </RecordDialog>
  );
};

/** Ficha del cliente: datos editables y, en pestañas, sus oportunidades, actividades e historial. */
export const ClienteDialog = ({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) => {
  const avisar = useAvisoGuardado();
  const refrescar = useRefrescarDatos();

  return (
    <EditBase
      resource="clientes"
      id={id}
      mutationMode="pessimistic"
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          avisar("Cliente guardado");
          void refrescar();
        },
      }}
      loading={<DialogoCargando onClose={onClose} />}
    >
      <Contenido onClose={onClose} />
    </EditBase>
  );
};
