import { Form, useGetIdentity, useLogout, useNotify } from "ra-core";
import { useState } from "react";
import type { FieldValues } from "react-hook-form";

import { SaveButton } from "@/components/admin/form";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { validarClave } from "../domain/validators";
import {
  getPerfil,
  invalidarPerfil,
  useCrmIdentity,
} from "../providers/authProvider";
import { getSupabaseClient } from "../providers/supabase";

interface CambioClave {
  password: string;
  confirmacion: string;
}

const coincideConClave = (valor: unknown, valores: Partial<CambioClave>) =>
  valor === valores.password ? undefined : "Las contraseñas no coinciden";

const mensajeDeErrorClave = (codigo: string | undefined): string => {
  if (codigo === "same_password") {
    return "Elegí una contraseña distinta de la provisoria.";
  }
  if (codigo === "weak_password") {
    return "La contraseña es demasiado débil. Probá con una más larga.";
  }
  return "No se pudo guardar la contraseña. Probá de nuevo.";
};

const MENSAJE_PROCESO_INCOMPLETO =
  "Tu contraseña ya se guardó, pero no pudimos terminar el proceso. Tocá «Guardar contraseña» de nuevo para reintentar.";

/** Diálogo bloqueante: quien recibió una contraseña provisoria debe elegir una propia. */
export const CambioClaveObligatorio = () => {
  const { identity } = useCrmIdentity();
  const { refetch } = useGetIdentity();
  const notify = useNotify();
  const logout = useLogout();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claveGuardada, setClaveGuardada] = useState(false);

  if (identity?.debeCambiarClave !== true) return null;

  const guardar = async (valores: FieldValues) => {
    const { password } = valores as CambioClave;
    // Variable local: el `catch` de abajo tiene que saber si la clave ya se guardó en este envío
    let guardada = claveGuardada;
    setEnviando(true);
    setError(null);
    try {
      if (!guardada) {
        const { error: errorClave } = await getSupabaseClient().auth.updateUser(
          { password },
        );
        if (errorClave) {
          setError(mensajeDeErrorClave(errorClave.code));
          return;
        }
        guardada = true;
        setClaveGuardada(true);
      }
      const { error: errorProceso } =
        await getSupabaseClient().rpc("clave_cambiada");
      if (errorProceso) {
        setError(MENSAJE_PROCESO_INCOMPLETO);
        return;
      }
      invalidarPerfil();
      await refetch();
      const perfil = await getPerfil();
      if (!perfil || perfil.debe_cambiar_clave === true) {
        setError(MENSAJE_PROCESO_INCOMPLETO);
        return;
      }
      notify("Contraseña actualizada", { type: "success" });
    } catch {
      setError(
        guardada ? MENSAJE_PROCESO_INCOMPLETO : mensajeDeErrorClave(undefined),
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(evento) => evento.preventDefault()}
        onPointerDownOutside={(evento) => evento.preventDefault()}
        onInteractOutside={(evento) => evento.preventDefault()}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Elegí tu contraseña</DialogTitle>
          <DialogDescription>
            Te dieron una contraseña provisoria. Para seguir usando el CRM,
            elegí una propia que solo vos conozcas.
          </DialogDescription>
        </DialogHeader>
        <Form
          mode="onBlur"
          reValidateMode="onChange"
          onSubmit={guardar}
          className="space-y-4"
        >
          <TextInput
            source="password"
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            validate={validarClave}
            disabled={enviando || claveGuardada}
          />
          <TextInput
            source="confirmacion"
            label="Repetir contraseña"
            type="password"
            autoComplete="new-password"
            validate={coincideConClave}
            disabled={enviando || claveGuardada}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => logout()}
            >
              Cerrar sesión
            </Button>
            <SaveButton label="Guardar contraseña" className="min-h-10" />
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
