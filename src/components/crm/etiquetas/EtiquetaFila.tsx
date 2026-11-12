import { Trash2 } from "lucide-react";
import { useDelete, useNotify, useUpdate } from "ra-core";
import { useEffect, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { formatFecha, plural } from "../domain/format";
import { COLORES_ETIQUETA, nombreDe } from "../domain/options";
import type { ColorEtiqueta, Etiqueta } from "../domain/types";
import { ConfirmarBorrado } from "../shared/ConfirmarBorrado";
import { CLASES_ETIQUETA, PUNTO_ETIQUETA } from "./estiloEtiqueta";
import { useRefrescarEtiquetas } from "./useEtiquetas";

const MAXIMO_NOMBRE = 40;

const mensajeDe = (error: unknown, porDefecto: string) =>
  error instanceof Error && error.message ? error.message : porDefecto;

/** Elegir el color: se guarda al tocarlo. */
const SelectorColor = ({
  etiqueta,
  onElegir,
}: {
  etiqueta: Etiqueta;
  onElegir: (color: ColorEtiqueta) => void;
}) => {
  const [abierto, setAbierto] = useState(false);
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={`Color de «${etiqueta.nombre}»: ${nombreDe(COLORES_ETIQUETA, etiqueta.color)}. Cambiar`}
        >
          <span
            aria-hidden
            className={cn(
              "size-4 rounded-full",
              PUNTO_ETIQUETA[etiqueta.color],
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div
          role="group"
          aria-label="Colores"
          className="grid grid-cols-5 gap-1"
        >
          {COLORES_ETIQUETA.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              title={opcion.name}
              aria-label={opcion.name}
              aria-pressed={opcion.id === etiqueta.color}
              onClick={() => {
                setAbierto(false);
                if (opcion.id !== etiqueta.color) onElegir(opcion.id);
              }}
              className={cn(
                "grid size-8 place-items-center rounded-md border border-transparent hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                opcion.id === etiqueta.color && "border-primary bg-accent",
              )}
            >
              <span
                aria-hidden
                className={cn("size-4 rounded-full", PUNTO_ETIQUETA[opcion.id])}
              />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Una etiqueta del catálogo con edición rápida: el nombre se edita en el
 * lugar (Enter o salir del campo guarda, Esc lo deja como estaba), el color se
 * elige del punto y la papelera la borra (con confirmación).
 */
export const EtiquetaFila = ({ etiqueta }: { etiqueta: Etiqueta }) => {
  const [actualizar, { isPending: guardando }] = useUpdate<Etiqueta>();
  const [eliminar, { isPending: eliminando }] = useDelete<Etiqueta>();
  const refrescarEtiquetas = useRefrescarEtiquetas();
  const notify = useNotify();
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => setNombre(etiqueta.nombre), [etiqueta.nombre]);

  const guardar = async (cambios: Partial<Etiqueta>) => {
    try {
      await actualizar(
        "etiquetas",
        { id: etiqueta.id, data: cambios, previousData: etiqueta },
        { mutationMode: "pessimistic", returnPromise: true },
      );
      void refrescarEtiquetas();
      notify("Etiqueta guardada", { type: "success" });
    } catch (error) {
      setNombre(etiqueta.nombre);
      notify(mensajeDe(error, "No se pudo guardar la etiqueta"), {
        type: "error",
      });
    }
  };

  const guardarNombre = () => {
    const limpio = nombre.trim().replace(/\s+/g, " ");
    if (limpio === etiqueta.nombre) {
      setNombre(etiqueta.nombre);
      return;
    }
    if (!limpio) {
      setNombre(etiqueta.nombre);
      notify("El nombre no puede quedar vacío", { type: "warning" });
      return;
    }
    void guardar({ nombre: limpio });
  };

  const alTeclear = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Enter") evento.currentTarget.blur();
    if (evento.key === "Escape") {
      const campo = evento.currentTarget;
      setNombre(etiqueta.nombre);
      // El blur ve el nombre original: no guarda
      requestAnimationFrame(() => campo.blur());
    }
  };

  const borrar = async () => {
    try {
      await eliminar(
        "etiquetas",
        { id: etiqueta.id, previousData: etiqueta },
        { mutationMode: "pessimistic", returnPromise: true },
      );
      setBorrando(false);
      void refrescarEtiquetas();
      notify("Etiqueta eliminada", { type: "success" });
    } catch (error) {
      notify(mensajeDe(error, "No se pudo eliminar la etiqueta"), {
        type: "error",
      });
    }
  };

  const clientes = etiqueta.clientes ?? 0;
  const alta = `Creada el ${formatFecha(etiqueta.creado_en)}${
    etiqueta.creado_por_nombre ? ` por ${etiqueta.creado_por_nombre}` : ""
  }`;

  return (
    <li
      className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2"
      aria-busy={guardando || undefined}
    >
      <SelectorColor
        etiqueta={etiqueta}
        onElegir={(color) => void guardar({ color })}
      />
      <div className="min-w-0 flex-1">
        {/* Se ve como el chip que llevan los clientes; tocarlo lo edita */}
        <input
          value={nombre}
          maxLength={MAXIMO_NOMBRE}
          onChange={(evento) => setNombre(evento.target.value)}
          onBlur={guardarNombre}
          onKeyDown={alTeclear}
          disabled={guardando}
          aria-label={`Nombre de la etiqueta «${etiqueta.nombre}»`}
          title="Tocá para renombrar"
          className={cn(
            "field-sizing-content max-w-full min-w-16 cursor-text rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-shadow outline-none hover:ring-2 hover:ring-ring/30 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            CLASES_ETIQUETA[etiqueta.color],
          )}
        />
        <p
          className="truncate px-1 pt-1 text-xs text-muted-foreground"
          title={alta}
        >
          {clientes ? plural(clientes, "cliente", "clientes") : "Sin clientes"}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Eliminar la etiqueta «${etiqueta.nombre}»`}
        onClick={() => setBorrando(true)}
      >
        <Trash2 />
      </Button>
      <ConfirmarBorrado
        abierto={borrando}
        onAbiertoChange={setBorrando}
        descripcion={`la etiqueta «${etiqueta.nombre}»`}
        detalle={
          clientes
            ? `Se quita de ${plural(clientes, "cliente", "clientes")}; los clientes no se borran.`
            : undefined
        }
        cargando={eliminando}
        onConfirmar={() => void borrar()}
      />
    </li>
  );
};
