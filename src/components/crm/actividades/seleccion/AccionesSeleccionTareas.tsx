import { Check, RotateCcw } from "lucide-react";
import { useUpdateMany } from "ra-core";

import { Button } from "@/components/ui/button";

import { plural } from "../../domain/format";
import type { Actividad } from "../../domain/types";
import { useCrmIdentity } from "../../providers/authProvider";
import { EliminarTareas } from "./EliminarTareas";
import { ReasignarTareas } from "./ReasignarTareas";
import { ReprogramarTareas } from "./ReprogramarTareas";
import { cuantas, useAccionLote } from "./useAccionLote";

/**
 * Acciones sobre las tareas seleccionadas, como en el CRM grande: completar,
 * reabrir, reprogramar, reasignar y eliminar. Cada una actúa solo sobre las
 * tareas a las que aplica (las notas siempre quedan completadas y no tienen
 * responsable) y avisa a cuántas si no son todas.
 */
export const AccionesSeleccionTareas = ({
  seleccionadas,
  limpiar,
}: {
  seleccionadas: Actividad[];
  limpiar: () => void;
}) => {
  const [actualizarVarias] = useUpdateMany();
  const { identity } = useCrmIdentity();
  const accion = useAccionLote(limpiar);
  const { enCurso, ejecutar } = accion;
  const total = seleccionadas.length;

  const editables = seleccionadas.filter((tarea) => tarea.tipo !== "nota");
  const pendientes = editables.filter((tarea) => !tarea.completada);
  const completadas = editables.filter((tarea) => tarea.completada);
  const borrables =
    identity?.rol === "administrador"
      ? seleccionadas
      : seleccionadas.filter((tarea) => tarea.creado_por === identity?.id);

  const cambiarEstado = (completar: boolean, tareas: Actividad[]) =>
    void ejecutar(completar ? "completar" : "reabrir", async () => {
      await actualizarVarias(
        "actividades",
        {
          ids: tareas.map((tarea) => tarea.id),
          data: { completada: completar },
        },
        { mutationMode: "pessimistic", returnPromise: true },
      );
      return completar
        ? plural(tareas.length, "tarea completada", "tareas completadas")
        : plural(tareas.length, "tarea reabierta", "tareas reabiertas");
    });

  return (
    <>
      {pendientes.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="success"
          loading={enCurso === "completar"}
          disabled={enCurso !== null}
          onClick={() => cambiarEstado(true, pendientes)}
        >
          <Check />
          Completar{cuantas(pendientes.length, total)}
        </Button>
      )}
      {completadas.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={enCurso === "reabrir"}
          disabled={enCurso !== null}
          onClick={() => cambiarEstado(false, completadas)}
        >
          <RotateCcw />
          Reabrir{cuantas(completadas.length, total)}
        </Button>
      )}
      <ReprogramarTareas
        {...accion}
        tareas={pendientes}
        seleccionadas={total}
      />
      <ReasignarTareas {...accion} tareas={editables} seleccionadas={total} />
      <EliminarTareas {...accion} tareas={borrables} seleccionadas={total} />
    </>
  );
};
