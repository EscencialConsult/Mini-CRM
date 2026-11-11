import { Trash2 } from "lucide-react";
import { useDeleteMany } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { plural } from "../../domain/format";
import type { Actividad } from "../../domain/types";
import { ConfirmarBorrado } from "../../shared/ConfirmarBorrado";
import { cuantas, type PropsAccionLote } from "./useAccionLote";

/**
 * Borra las tareas en un solo pedido, con confirmación. Recibe solo las que
 * quien está conectado puede borrar (el administrador, todas; el resto, las
 * que creó).
 */
export const EliminarTareas = ({
  tareas,
  seleccionadas,
  enCurso,
  ejecutar,
}: PropsAccionLote & { tareas: Actividad[]; seleccionadas: number }) => {
  const [borrarVarias] = useDeleteMany();
  const [abierto, setAbierto] = useState(false);
  if (tareas.length === 0) return null;

  const confirmar = async () => {
    const salioBien = await ejecutar("eliminar", async () => {
      await borrarVarias(
        "actividades",
        { ids: tareas.map((tarea) => tarea.id) },
        { mutationMode: "pessimistic", returnPromise: true },
      );
      return plural(tareas.length, "tarea eliminada", "tareas eliminadas");
    });
    if (salioBien) setAbierto(false);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        disabled={enCurso !== null}
        onClick={() => setAbierto(true)}
      >
        <Trash2 />
        Eliminar{cuantas(tareas.length, seleccionadas)}
      </Button>
      <ConfirmarBorrado
        abierto={abierto}
        onAbiertoChange={setAbierto}
        descripcion={plural(tareas.length, "tarea", "tareas")}
        detalle={
          tareas.length < seleccionadas
            ? `Solo podés eliminar las tareas que creaste: de las ${seleccionadas} seleccionadas se eliminan ${tareas.length}.`
            : undefined
        }
        cargando={enCurso === "eliminar"}
        onConfirmar={() => void confirmar()}
      />
    </>
  );
};
