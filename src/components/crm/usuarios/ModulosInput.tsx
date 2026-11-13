import { useInput } from "ra-core";
import { useWatch } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";

import { MODULOS, type Modulo } from "../domain/modulos";
import type { Rol } from "../domain/types";

const Titulo = () => <legend className="text-sm font-medium">Módulos</legend>;

interface ModulosInputProps {
  /** Solo estos módulos (los de la cuenta); sin él, todos. */
  disponibles?: readonly Modulo[];
  /** Plan de una cuenta: no hay rol que exima y el texto cambia. */
  plan?: boolean;
}

/**
 * Partes del CRM que el usuario puede usar (o, en `plan`, que tiene una
 * cuenta). El administrador de una cuenta las tiene todas las de su cuenta: su
 * lista se conserva igual por si un día deja de serlo.
 */
export const ModulosInput = ({ disponibles, plan }: ModulosInputProps) => {
  const rol = useWatch({ name: "rol" }) as Rol | undefined;
  const { field } = useInput<Modulo[]>({ source: "modulos" });
  const elegidos: Modulo[] = field.value ?? [];
  const ofrecidos = MODULOS.filter(
    (modulo) => !disponibles || disponibles.includes(modulo.id),
  );

  // Siempre en el orden del menú, sin repetidos
  const alternar = (modulo: Modulo, marcado: boolean) =>
    field.onChange(
      MODULOS.map(({ id }) => id).filter((id) =>
        id === modulo ? marcado : elegidos.includes(id),
      ),
    );

  if (!plan && rol === "administrador") {
    return (
      <fieldset className="space-y-1">
        <Titulo />
        <p className="text-sm text-muted-foreground">
          El administrador tiene acceso a todo lo que incluye la cuenta,
          Usuarios incluido.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-2" onBlur={field.onBlur}>
      <Titulo />
      <p className="text-sm text-muted-foreground">
        {plan
          ? "Lo que contrata la cuenta. Sus usuarios solo pueden tener estos módulos; lo que quites deja de funcionarles."
          : "Lo que no esté marcado no le aparece en el menú ni puede abrirlo. Con Tablero o Tareas sin Clientes, ve y elige clientes pero no los edita."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ofrecidos.map((modulo) => {
          const idCampo = `modulo-${modulo.id}`;
          return (
            <label
              key={modulo.id}
              htmlFor={idCampo}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox
                id={idCampo}
                checked={elegidos.includes(modulo.id)}
                onCheckedChange={(valor) => alternar(modulo.id, valor === true)}
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{modulo.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {modulo.descripcion}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {elegidos.length === 0 && (
        <p role="status" className="text-sm text-destructive">
          {plan
            ? "Sin módulos, nadie de la cuenta ve nada."
            : "Sin módulos, el usuario entra pero no ve nada."}
        </p>
      )}
    </fieldset>
  );
};
