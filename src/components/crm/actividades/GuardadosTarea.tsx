import { Check, RotateCcw } from "lucide-react";
import { useWatch } from "react-hook-form";

import type { Actividad, TipoActividad } from "../domain/types";
import { GuardarCon } from "../shared/RecordForm";

/**
 * Completar o reabrir desde el modal: guardan el formulario junto con el
 * cambio de estado. Las notas no tienen (siempre están completadas).
 */
export const GuardadosTarea = ({ actividad }: { actividad?: Actividad }) => {
  const tipo = useWatch({ name: "tipo" }) as TipoActividad | undefined;
  if (tipo === "nota") return null;

  if (!actividad) {
    return (
      <GuardarCon
        etiqueta="Guardar completada"
        icono={<Check />}
        variante="success"
        valores={{ completada: true }}
      />
    );
  }
  return actividad.completada ? (
    <GuardarCon
      etiqueta="Reabrir"
      icono={<RotateCcw />}
      valores={{ completada: false }}
    />
  ) : (
    <GuardarCon
      etiqueta="Completar"
      icono={<Check />}
      variante="success"
      valores={{ completada: true }}
    />
  );
};
