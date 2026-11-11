import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, required, useGetOne, useNotify } from "ra-core";
import { useFormContext, type FieldValues } from "react-hook-form";

import { BooleanInput } from "@/components/admin/boolean-input";
import { SaveButton } from "@/components/admin/form";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { ROLES } from "../domain/options";
import type {
  CambiosUsuario,
  NuevoUsuario,
  Rol,
  Usuario,
} from "../domain/types";
import {
  validarClave,
  validarEmailObligatorio,
  type Validator,
} from "../domain/validators";
import { invalidarPerfil, useCrmIdentity } from "../providers/authProvider";
import { useCrmDataProvider } from "../providers/dataProvider";
import { RecordDialog } from "../shared/RecordDialog";
import { useRefrescarDatos } from "../shared/useRefrescarDatos";

interface UsuarioFormDialogProps {
  /** Con id edita; sin id crea. */
  id?: string;
  onClose: () => void;
}

interface ValoresUsuario {
  email?: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  activo: boolean;
  password?: string;
}

const ALFABETO_CLAVE =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

const claveOpcional: Validator = (valor) =>
  valor ? validarClave(valor) : undefined;

const GeneradorClave = () => {
  const { setValue } = useFormContext();
  const generar = () => {
    const azar = crypto.getRandomValues(new Uint32Array(12));
    const clave = Array.from(
      azar,
      (numero) => ALFABETO_CLAVE[numero % ALFABETO_CLAVE.length],
    ).join("");
    setValue("password", clave, { shouldDirty: true, shouldValidate: true });
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={generar}>
      Generar contraseña
    </Button>
  );
};

const Campos = ({
  editando,
  esUnoMismo,
}: {
  editando: boolean;
  esUnoMismo: boolean;
}) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInput source="nombre" label="Nombre" validate={required()} />
      <TextInput source="apellido" label="Apellido" validate={required()} />
    </div>
    {editando ? (
      <TextInput source="email" label="Email" disabled />
    ) : (
      <TextInput
        source="email"
        label="Email"
        type="email"
        parse={(valor: string) => valor.trim().toLowerCase()}
        validate={validarEmailObligatorio}
      />
    )}
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectInput
        source="rol"
        label="Rol"
        choices={ROLES}
        disabled={esUnoMismo}
        validate={required()}
        helperText={esUnoMismo ? "No podés cambiar tu propio rol." : undefined}
      />
      {editando && (
        <BooleanInput
          source="activo"
          label="Cuenta activa"
          disabled={esUnoMismo}
        />
      )}
    </div>
    <div className="space-y-2">
      {/* Visible a propósito: el administrador se la comunica al usuario */}
      <TextInput
        source="password"
        label={editando ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
        autoComplete="new-password"
        validate={editando ? claveOpcional : validarClave}
        helperText={
          editando
            ? "Si la completás, reemplaza la contraseña actual del usuario."
            : "Mínimo 8 caracteres. Compartísela al usuario; puede cambiarla después."
        }
      />
      <GeneradorClave />
    </div>
  </>
);

/** Alta y edición de usuarios. Pasa por la Edge Function `users` (solo administradores). */
export const UsuarioFormDialog = ({ id, onClose }: UsuarioFormDialogProps) => {
  const dataProvider = useCrmDataProvider();
  const { identity } = useCrmIdentity();
  const notify = useNotify();
  const refrescar = useRefrescarDatos();
  const queryClient = useQueryClient();
  const editando = id !== undefined;

  const { data: usuario, isPending } = useGetOne<Usuario>(
    "usuarios",
    { id: id ?? "" },
    { enabled: editando },
  );

  const guardar = useMutation({
    mutationFn: async (valores: ValoresUsuario): Promise<Usuario> => {
      if (!editando) {
        const nuevo: NuevoUsuario = {
          email: valores.email ?? "",
          password: valores.password ?? "",
          nombre: valores.nombre,
          apellido: valores.apellido,
          rol: valores.rol,
        };
        return dataProvider.crearUsuario(nuevo);
      }
      const cambios: CambiosUsuario = {
        id: id as string,
        nombre: valores.nombre,
        apellido: valores.apellido,
        rol: valores.rol,
        activo: valores.activo,
        ...(valores.password ? { password: valores.password } : {}),
      };
      return dataProvider.actualizarUsuario(cambios);
    },
    onSuccess: async () => {
      notify(editando ? "Usuario actualizado" : "Usuario creado", {
        type: "success",
      });
      invalidarPerfil();
      await queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      void refrescar();
      onClose();
    },
    onError: (error) => notify(mensajeDe(error), { type: "error" }),
  });

  if (editando && isPending) {
    return (
      <RecordDialog title="Cargando…" onClose={onClose} size="md">
        <div className="space-y-3 p-6" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </RecordDialog>
    );
  }
  if (editando && !usuario) return null;

  const esUnoMismo = editando && usuario?.id === identity?.id;

  return (
    <RecordDialog
      title={
        usuario ? `${usuario.nombre} ${usuario.apellido}` : "Nuevo usuario"
      }
      description={
        editando
          ? "Datos de acceso, rol y estado de la cuenta."
          : "Crea el acceso al CRM: el usuario entra con su email y la contraseña inicial."
      }
      size="md"
      onClose={onClose}
    >
      <Form
        mode="onBlur"
        reValidateMode="onChange"
        record={usuario}
        defaultValues={editando ? undefined : { rol: "vendedor", activo: true }}
        // Espera la respuesta: el botón queda en carga hasta que termina
        onSubmit={async (valores: FieldValues) => {
          await guardar
            .mutateAsync(valores as ValoresUsuario)
            .catch(() => undefined);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto bg-background px-6 py-5">
          <Campos editando={editando} esUnoMismo={esUnoMismo} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <SaveButton label={editando ? "Guardar" : "Crear usuario"} />
        </div>
      </Form>
    </RecordDialog>
  );
};
