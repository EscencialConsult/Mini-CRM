import { UserMinus, UserPlus, UserRound, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { plural } from "../../domain/format";
import type { Actividad } from "../../domain/types";
import { useCrmIdentity } from "../../providers/authProvider";
import { useCrmDataProvider } from "../../providers/dataProvider";
import type { OpcionUsuario } from "../../shared/useUsuarios";
import { useUsuarios } from "../../shared/useUsuarios";
import { cuantas, type PropsAccionLote } from "./useAccionLote";

type Modo = "agregar" | "quitar" | "reemplazar";

const LISTA = "max-h-72 overflow-y-auto";

/**
 * Responsables de las tareas seleccionadas (las notas no tienen), en un solo
 * pedido: sumar o quitar a alguien sin tocar al resto, o reemplazarlos a todos.
 */
export const ReasignarTareas = ({
  tareas,
  seleccionadas,
  enCurso,
  ejecutar,
}: PropsAccionLote & { tareas: Actividad[]; seleccionadas: number }) => {
  const dataProvider = useCrmDataProvider();
  const { identity } = useCrmIdentity();
  const { opcionesActivas, opcionesTodas } = useUsuarios();
  if (tareas.length === 0) return null;

  const nombre = (opcion: OpcionUsuario) =>
    opcion.id === identity?.id ? `${opcion.name} (yo)` : opcion.name;
  // Agregar: a quien falte en alguna. Quitar: a quien esté en alguna.
  const agregables = opcionesActivas.filter((opcion) =>
    tareas.some((tarea) => !tarea.asignados.includes(opcion.id)),
  );
  const quitables = opcionesTodas.filter((opcion) =>
    tareas.some((tarea) => tarea.asignados.includes(opcion.id)),
  );

  const cambiar = (modo: Modo, usuario: OpcionUsuario | null) =>
    void ejecutar("reasignar", async () => {
      const cambiadas = await dataProvider.rpc<number>(
        "cambiar_responsables_actividades",
        {
          p_ids: tareas.map((tarea) => tarea.id),
          p_modo: modo,
          p_usuario: usuario?.id ?? null,
        },
      );
      if (cambiadas === 0) return "Las tareas ya tenían esos responsables";
      const cantidad = plural(cambiadas, "tarea", "tareas");
      if (modo === "agregar") return `${usuario?.name} se sumó a ${cantidad}`;
      if (modo === "quitar") return `${usuario?.name} salió de ${cantidad}`;
      return usuario
        ? `${cantidad} quedaron a cargo de ${usuario.name}`
        : `${cantidad} quedaron sin responsables`;
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={enCurso === "reasignar"}
          disabled={enCurso !== null}
        >
          <Users />
          Responsables{cuantas(tareas.length, seleccionadas)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={agregables.length === 0}>
            <UserPlus />
            Agregar a…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={LISTA}>
            {agregables.map((opcion) => (
              <DropdownMenuItem
                key={opcion.id}
                onSelect={() => cambiar("agregar", opcion)}
              >
                {nombre(opcion)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={quitables.length === 0}>
            <UserMinus />
            Quitar a…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={LISTA}>
            {quitables.map((opcion) => (
              <DropdownMenuItem
                key={opcion.id}
                onSelect={() => cambiar("quitar", opcion)}
              >
                {nombre(opcion)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserRound />
            Reemplazar por…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={LISTA}>
            {opcionesActivas.map((opcion) => (
              <DropdownMenuItem
                key={opcion.id}
                onSelect={() => cambiar("reemplazar", opcion)}
              >
                {nombre(opcion)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => cambiar("reemplazar", null)}>
              Sin responsables
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
