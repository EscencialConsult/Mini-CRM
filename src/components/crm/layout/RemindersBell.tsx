import { Bell } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { aIsoFecha, hoyIso } from "../domain/format";
import { useCrmIdentity } from "../providers/authProvider";
import { useIrAListado } from "../shared/useIrAListado";
import { useRecordatorios } from "./useRecordatorios";

interface Recordatorio {
  id: string;
  texto: string;
  cantidad: number;
  abrir: () => void;
}

const inicioDeDia = (desfase: number): string => {
  const dia = new Date();
  dia.setHours(0, 0, 0, 0);
  dia.setDate(dia.getDate() + desfase);
  return dia.toISOString();
};

/** Campana de recordatorios de seguimiento: tareas y contactos vencidos o de hoy. */
export const RemindersBell = () => {
  const { identity } = useCrmIdentity();
  const { conteo, total } = useRecordatorios();
  const irA = useIrAListado();
  const [abierto, setAbierto] = useState(false);

  const propias = identity ? { asignado_a: identity.id } : {};
  const ir = (accion: () => void) => () => {
    setAbierto(false);
    accion();
  };

  const recordatorios: Recordatorio[] = [
    {
      id: "actividades_vencidas",
      texto: "tareas vencidas",
      cantidad: conteo.actividades_vencidas,
      abrir: ir(() =>
        irA(
          "actividades",
          { ...propias, completada: false, vencida: true },
          { field: "fecha", order: "ASC" },
        ),
      ),
    },
    {
      id: "actividades_hoy",
      texto: "tareas para hoy",
      cantidad: conteo.actividades_hoy,
      abrir: ir(() =>
        irA(
          "actividades",
          {
            ...propias,
            completada: false,
            "fecha@gte": inicioDeDia(0),
            "fecha@lt": inicioDeDia(1),
          },
          { field: "fecha", order: "ASC" },
        ),
      ),
    },
    {
      id: "contactos_vencidos",
      texto: "contactos atrasados",
      cantidad: conteo.contactos_vencidos,
      abrir: ir(() =>
        irA(
          "clientes",
          { ...propias, estado: "activo", "proximo_contacto@lt": hoyIso() },
          { field: "proximo_contacto", order: "ASC" },
        ),
      ),
    },
    {
      id: "contactos_hoy",
      texto: "contactos para hoy",
      cantidad: conteo.contactos_hoy,
      abrir: ir(() =>
        irA(
          "clientes",
          {
            ...propias,
            estado: "activo",
            proximo_contacto: aIsoFecha(new Date()),
          },
          { field: "nombre_completo", order: "ASC" },
        ),
      ),
    },
  ];

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            total > 0
              ? `Recordatorios: ${total} pendientes`
              : "Recordatorios: ninguno pendiente"
          }
        >
          <Bell />
          {total > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white"
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2">
        <p className="text-sm font-medium">Recordatorios de seguimiento</p>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenés pendientes para hoy.
          </p>
        ) : (
          <ul className="space-y-1">
            {recordatorios
              .filter((recordatorio) => recordatorio.cantidad > 0)
              .map((recordatorio) => (
                <li key={recordatorio.id}>
                  <button
                    type="button"
                    onClick={recordatorio.abrir}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{recordatorio.texto}</span>
                    <span className="font-semibold tabular-nums">
                      {recordatorio.cantidad}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
