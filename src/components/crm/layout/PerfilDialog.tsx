import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, required, useGetIdentity, useGetOne, useNotify } from "ra-core";
import { useState } from "react";
import type { FieldValues } from "react-hook-form";

import { SaveButton } from "@/components/admin/form";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { nombreDe, ROLES } from "../domain/options";
import type { Usuario } from "../domain/types";
import { validarClave } from "../domain/validators";
import { invalidarPerfil, useCrmIdentity } from "../providers/authProvider";
import { getSupabaseClient } from "../providers/supabase";
import { RecordDialog } from "../shared/RecordDialog";

interface DatosPerfil {
  nombre: string;
  apellido: string;
}

interface CambioClave {
  password: string;
  confirmacion: string;
}

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

const coincideConClave = (valor: unknown, valores: Partial<CambioClave>) =>
  valor === valores.password ? undefined : "Las contraseñas no coinciden";

const SeccionDatos = ({ usuario }: { usuario: Usuario }) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { refetch } = useGetIdentity();

  const guardar = useMutation({
    mutationFn: async (datos: DatosPerfil) => {
      const { error } = await getSupabaseClient()
        .from("usuarios")
        .update({
          nombre: datos.nombre.trim(),
          apellido: datos.apellido.trim(),
        })
        .eq("id", usuario.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      invalidarPerfil();
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
      ]);
      notify("Perfil actualizado", { type: "success" });
    },
    onError: (error) => notify(mensajeDe(error), { type: "error" }),
  });

  return (
    <Form
      mode="onBlur"
      reValidateMode="onChange"
      record={usuario}
      onSubmit={async (valores: FieldValues) => {
        await guardar
          .mutateAsync(valores as DatosPerfil)
          .catch(() => undefined);
      }}
      className="space-y-4"
    >
      <h3 className="text-sm font-medium">Mis datos</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput source="nombre" label="Nombre" validate={required()} />
        <TextInput source="apellido" label="Apellido" validate={required()} />
      </div>
      <p className="text-sm text-muted-foreground">
        {usuario.email} · {nombreDe(ROLES, usuario.rol)}
      </p>
      <SaveButton label="Guardar datos" />
    </Form>
  );
};

const SeccionClave = () => {
  const notify = useNotify();
  // Al cambiar la clave se remonta el formulario: los campos quedan vacíos
  const [version, setVersion] = useState(0);

  const cambiar = useMutation({
    mutationFn: async (valores: CambioClave) => {
      const { error } = await getSupabaseClient().auth.updateUser({
        password: valores.password,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      notify("Contraseña actualizada", { type: "success" });
      setVersion((actual) => actual + 1);
    },
    onError: (error) => notify(mensajeDe(error), { type: "error" }),
  });

  return (
    <Form
      key={version}
      mode="onBlur"
      reValidateMode="onChange"
      onSubmit={async (valores: FieldValues) => {
        await cambiar
          .mutateAsync(valores as CambioClave)
          .catch(() => undefined);
      }}
      className="space-y-4"
    >
      <h3 className="text-sm font-medium">Cambiar contraseña</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          source="password"
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          validate={validarClave}
        />
        <TextInput
          source="confirmacion"
          label="Repetir contraseña"
          type="password"
          autoComplete="new-password"
          validate={coincideConClave}
        />
      </div>
      <SaveButton label="Cambiar contraseña" />
    </Form>
  );
};

/** Perfil propio: nombre, apellido y contraseña. */
export const PerfilDialog = ({ onClose }: { onClose: () => void }) => {
  const { identity } = useCrmIdentity();
  const { data: usuario } = useGetOne<Usuario>(
    "usuarios",
    { id: identity?.id ?? "" },
    { enabled: Boolean(identity) },
  );

  return (
    <RecordDialog
      title="Mi perfil"
      description="Tus datos y tu contraseña de acceso."
      size="md"
      onClose={onClose}
    >
      <div className="space-y-6 px-6 py-5">
        {usuario ? (
          <>
            <SeccionDatos usuario={usuario} />
            <Separator />
            <SeccionClave />
          </>
        ) : (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </RecordDialog>
  );
};
