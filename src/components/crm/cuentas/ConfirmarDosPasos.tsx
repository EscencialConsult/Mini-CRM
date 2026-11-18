import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { confirmarCodigoMfa, leerEstadoMfa } from "../providers/mfa";

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo confirmar el código";

/**
 * Compuerta de la administración de cuentas: si el dueño del sistema activó la
 * verificación en dos pasos y esta sesión todavía no la confirmó, pide el código.
 * Quien hace cumplir la regla es la Edge Function; esto es sólo comodidad.
 */
export const ConfirmarDosPasos = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const campoId = useId();
  const [codigo, setCodigo] = useState("");

  const estado = useQuery({
    queryKey: ["mfa", "estado"],
    queryFn: leerEstadoMfa,
  });

  const confirmar = useMutation({
    mutationFn: async (factorId: string) => {
      await confirmarCodigoMfa(factorId, codigo.trim());
    },
    onSuccess: async () => {
      setCodigo("");
      await queryClient.invalidateQueries({ queryKey: ["mfa", "estado"] });
    },
  });

  if (estado.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const datos = estado.data;
  if (estado.isError || !datos?.activada || datos.sesionConfirmada) {
    return <>{children}</>;
  }

  const factorId = datos.factorId;

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (factorId) confirmar.mutate(factorId);
  };

  return (
    <form
      onSubmit={enviar}
      className="mx-auto w-full max-w-md space-y-4 rounded-xl border bg-card p-6"
    >
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Confirmá tu identidad</h1>
        <p className="text-sm text-muted-foreground">
          Ingresá el código de 6 dígitos de tu aplicación de autenticación para
          administrar las cuentas.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={campoId}>Código de 6 dígitos</Label>
        <Input
          id={campoId}
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
            if (confirmar.isError) confirmar.reset();
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-invalid={confirmar.isError}
          className="h-10 font-mono tracking-widest"
        />
      </div>
      {confirmar.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mensajeDe(confirmar.error)}
        </p>
      )}
      <Button
        type="submit"
        className="min-h-10"
        loading={confirmar.isPending}
        disabled={codigo.length !== 6 || !factorId}
      >
        Confirmar
      </Button>
      <p className="text-xs text-muted-foreground">
        Si perdiste tu aplicación, quitá el factor desde el panel de Supabase
        (Authentication → Users).
      </p>
    </form>
  );
};
