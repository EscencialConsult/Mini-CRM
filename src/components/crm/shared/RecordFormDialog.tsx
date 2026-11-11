import { CreateBase, EditBase, useRecordContext, type RaRecord } from "ra-core";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { AutoriaInfo } from "./AutoriaInfo";
import { RecordDialog } from "./RecordDialog";
import { RecordForm } from "./RecordForm";
import { useAvisoGuardado } from "./useAvisoGuardado";
import { useRefrescarDatos } from "./useRefrescarDatos";

export const DialogoCargando = ({ onClose }: { onClose: () => void }) => (
  <RecordDialog title="Cargando…" onClose={onClose}>
    <div className="space-y-3 p-6" aria-busy="true">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  </RecordDialog>
);

interface RecordFormDialogProps<T extends RaRecord> {
  resource: string;
  /** Con id edita; sin id crea. */
  id?: string;
  tituloCrear: string;
  tituloEditar: (registro: T) => string;
  descripcion?: string;
  /** Bajada al editar (estado, datos clave…); sin ella se usa `descripcion`. */
  descripcionEditar?: (registro: T) => ReactNode;
  mensajeGuardado: string;
  defaultValues?: Record<string, unknown>;
  transform?: (datos: Record<string, unknown>) => Record<string, unknown>;
  /** Acciones del pie en modo edición, junto a Cancelar (eliminar…). */
  acciones?: (registro: T) => ReactNode;
  /** Otros guardados (<GuardarCon>) entre Cancelar y Guardar; sin registro, es un alta. */
  guardadosExtra?: (registro: T | undefined) => ReactNode;
  size?: "md" | "lg" | "xl";
  onClose: () => void;
  /** Se llama al guardar; por defecto, cierra el modal. */
  onSaved?: (registro: T) => void;
  children: ReactNode;
}

const Contenido = <T extends RaRecord>({
  id,
  tituloCrear,
  tituloEditar,
  descripcion,
  descripcionEditar,
  defaultValues,
  acciones,
  guardadosExtra,
  size,
  onClose,
  children,
}: Omit<
  RecordFormDialogProps<T>,
  "resource" | "mensajeGuardado" | "transform" | "onSaved"
>) => {
  const registro = useRecordContext<T>();
  const editando = id !== undefined;
  if (editando && !registro) return null;

  return (
    <RecordDialog
      title={editando && registro ? tituloEditar(registro) : tituloCrear}
      description={
        editando && registro && descripcionEditar
          ? descripcionEditar(registro)
          : descripcion
      }
      size={size}
      onClose={onClose}
    >
      <RecordForm
        defaultValues={defaultValues}
        onCancel={onClose}
        footerActions={editando && registro ? acciones?.(registro) : undefined}
        extraSaves={guardadosExtra?.(editando ? registro : undefined)}
        footerInfo={
          editando && registro ? (
            <AutoriaInfo {...(registro as Record<string, never>)} />
          ) : undefined
        }
      >
        {children}
      </RecordForm>
    </RecordDialog>
  );
};

/**
 * Modal de alta o edición de un registro, con guardado pessimista (el botón
 * espera la respuesta), aviso de resultado y refresco de los datos derivados.
 */
export const RecordFormDialog = <T extends RaRecord>({
  resource,
  id,
  mensajeGuardado,
  transform,
  onSaved,
  onClose,
  ...resto
}: RecordFormDialogProps<T>) => {
  const avisar = useAvisoGuardado();
  const refrescar = useRefrescarDatos();

  const alGuardar = (registro: T) => {
    avisar(mensajeGuardado);
    void refrescar();
    if (onSaved) onSaved(registro);
    else onClose();
  };

  const comunes = {
    resource,
    mutationMode: "pessimistic" as const,
    redirect: false as const,
    transform,
  };
  const contenido = <Contenido<T> id={id} onClose={onClose} {...resto} />;

  if (id !== undefined) {
    return (
      <EditBase<T>
        {...comunes}
        id={id}
        mutationOptions={{ onSuccess: alGuardar }}
        loading={<DialogoCargando onClose={onClose} />}
      >
        {contenido}
      </EditBase>
    );
  }
  return (
    <CreateBase<T> {...comunes} mutationOptions={{ onSuccess: alGuardar }}>
      {contenido}
    </CreateBase>
  );
};
