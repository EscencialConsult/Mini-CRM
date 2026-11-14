import { Eye, EyeOff } from "lucide-react";
import { Form, useLogin, useNotify } from "ra-core";
import { useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";

import logo from "@/assets/logo.webp";
import { Notification } from "@/components/admin/notification";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";

import {
  validarEmailObligatorio,
  validarObligatorio,
} from "../domain/validators";
import { Wordmark } from "../layout/Wordmark";
import { FondoLogin } from "./FondoLogin";

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
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 py-10">
      {/* Un solo fondo para toda la pantalla: cinta ondulada y hexágonos alrededor del contenido */}
      <FondoLogin />

      <div className="relative grid w-full max-w-4xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <aside className="hidden lg:flex lg:flex-col lg:gap-10">
          <div className="flex flex-col gap-5">
            <div className="relative w-36">
              {/* Resplandor suave y amplio: se funde con el fondo, sin borde visible */}
              <div
                aria-hidden
                className="absolute top-1/2 left-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--marca-2)_var(--brillo),transparent),transparent)] [--brillo:12%] dark:[--brillo:18%]"
              />
              <img className="relative w-36" src={logo} alt="" />
            </div>
            <Wordmark className="text-5xl" />
          </div>
          <div>
            <p className="text-4xl font-semibold leading-[1.1] tracking-tight">
              Cada contacto es una venta en camino.
            </p>
            <p className="mt-4 text-base text-muted-foreground">
              Seguí cada oportunidad del primer mensaje al cierre, sin perder a
              nadie en el medio.
            </p>
          </div>
        </aside>

        <section className="mx-auto w-full max-w-sm lg:mx-0">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <img className="size-12" src={logo} alt="" />
            <Wordmark className="text-3xl" />
          </div>
          <h1 className="mb-8 text-3xl font-semibold tracking-tight">
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
              inputClassName="h-11 rounded-md bg-background px-3.5"
              validate={validarEmailObligatorio}
            />
            <div className="grid gap-2 [&>[data-slot=form-item]]:contents [&_[data-slot=form-label]]:row-start-1 [&_[data-slot=form-control]]:col-start-1 [&_[data-slot=form-control]]:row-start-2 [&_[data-slot=form-control]]:pr-12">
              <TextInput
                label="Contraseña"
                source="password"
                type={verClave ? "text" : "password"}
                autoComplete="current-password"
                inputClassName="h-11 rounded-md bg-background px-3.5"
                validate={validarObligatorio}
              />
              <button
                type="button"
                className="col-start-1 row-start-2 mr-0.5 flex size-10 items-center self-center justify-self-end justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="h-11 w-full bg-marca text-base font-semibold text-black marca-desliza! transition-[background-position] duration-700 ease-in-out"
              loading={enviando}
            >
              Ingresar
            </Button>
          </Form>
        </section>
      </div>
      <Notification />
    </main>
  );
};
