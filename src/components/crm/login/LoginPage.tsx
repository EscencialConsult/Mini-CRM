import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Form, useLogin, useNotify } from "ra-core";
import { useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";

import logoClaro from "@/assets/logo_atomic_crm_light.svg";
import logoOscuro from "@/assets/logo_atomic_crm_dark.svg";
import { Notification } from "@/components/admin/notification";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";

import {
  validarEmailObligatorio,
  validarObligatorio,
} from "../domain/validators";
import { APP_TITLE } from "../root/config";

/** Inicio de sesión con email y contraseña (las cuentas las crea un administrador). */
export const LoginPage = ({ redirectTo }: { redirectTo?: string }) => {
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const login = useLogin();
  const notify = useNotify();

  const alEnviar: SubmitHandler<FieldValues> = async (valores) => {
    setEnviando(true);
    try {
      await login(valores, redirectTo);
    } catch (error) {
      notify(
        error instanceof Error && error.message
          ? error.message
          : "ra.auth.sign_in_error",
        { type: "error" },
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-[440px]">
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-xl shadow-foreground/[0.04] sm:p-9">
          <div className="mb-8 flex items-center gap-3">
            <img className="size-12 [.dark_&]:hidden" src={logoClaro} alt="" />
            <img
              className="hidden size-12 [.dark_&]:block"
              src={logoOscuro}
              alt=""
            />
            <span className="text-xl font-semibold">{APP_TITLE}</span>
          </div>
          <h1 className="mb-7 text-2xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>

          <Form
            className="space-y-5"
            mode="onBlur"
            reValidateMode="onChange"
            onSubmit={alEnviar}
          >
            <TextInput
              label="Correo electrónico"
              source="email"
              type="email"
              autoComplete="email"
              inputClassName="h-12 rounded-xl bg-background px-4"
              validate={validarEmailObligatorio}
            />
            <div className="relative [&_[data-slot=input]]:pr-12">
              <TextInput
                label="Contraseña"
                source="password"
                type={verClave ? "text" : "password"}
                autoComplete="current-password"
                inputClassName="h-12 rounded-xl bg-background px-4"
                validate={validarObligatorio}
              />
              <button
                type="button"
                className="absolute right-2 top-[31px] flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setVerClave((visible) => !visible)}
                aria-label={
                  verClave ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={verClave}
              >
                {verClave ? (
                  <EyeOff aria-hidden className="size-4" />
                ) : (
                  <Eye aria-hidden className="size-4" />
                )}
              </button>
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold shadow-md shadow-primary/15"
              loading={enviando}
            >
              Ingresar
              {!enviando && <ArrowRight aria-hidden className="size-4" />}
            </Button>
          </Form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            ¿Olvidaste tu contraseña? Pedile al administrador que la
            restablezca.
          </p>
        </div>
      </section>
      <Notification />
    </main>
  );
};
