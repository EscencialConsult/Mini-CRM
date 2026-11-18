import { Check } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";

import type { Modulo } from "../domain/modulos";
import {
  PLANES,
  PRECIO_USUARIO_EXTRA,
  planDe,
  type PlanComercial,
} from "./planes";

const pesos = (valor: number) =>
  valor === 0
    ? "Gratis"
    : `${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valor)}/mes`;

/**
 * Elegir el plan de la cuenta con un toque: marca los módulos y el máximo de
 * usuarios de la propuesta. Muestra cuál está en uso y avisa si lo de abajo se
 * ajustó a mano («Personalizado»).
 */
export const PlanesInput = () => {
  const { setValue } = useFormContext();
  const modulos = useWatch({ name: "modulos" }) as Modulo[] | undefined;
  const maximo = useWatch({ name: "max_usuarios" });
  const actual = planDe(modulos, maximo);

  const elegir = (plan: PlanComercial) => {
    setValue("modulos", plan.modulos, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("max_usuarios", plan.maxUsuarios, {
      shouldDirty: true,
      shouldValidate: true,
    });
    // Solo el plan «Prueba» lleva los días gratis
    // Sin marcar como modificado: en edición este campo no se envía
    setValue("prueba", plan.id === "prueba", { shouldDirty: false });
  };

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Plan de la cuenta"
        className="grid gap-2 sm:grid-cols-2"
      >
        {PLANES.map((plan) => {
          const elegido = actual?.id === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={elegido}
              onClick={() => elegir(plan)}
              className={cn(
                "flex min-h-20 flex-col gap-0.5 rounded-md border p-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                elegido && "border-primary bg-primary/5",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{plan.nombre}</span>
                {elegido && <Check className="size-4 text-primary" />}
              </span>
              <span className="text-sm">
                {pesos(plan.precio)} · hasta {plan.maxUsuarios} usuarios
              </span>
              <span className="text-xs text-muted-foreground">
                {plan.resumen}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {actual ? (
          <>
            Plan <strong>{actual.nombre}</strong>
            {modulos?.includes("asistente_altas") && " con Asistente: altas"}.
          </>
        ) : (
          <>
            <strong>Personalizado</strong>: los módulos o el máximo de usuarios
            no coinciden con ningún plan.
          </>
        )}{" "}
        Cada usuario extra suma {pesos(PRECIO_USUARIO_EXTRA)}: subí el máximo de
        usuarios.
      </p>
    </div>
  );
};
