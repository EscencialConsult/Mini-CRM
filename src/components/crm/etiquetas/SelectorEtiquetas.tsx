import { Command as CommandPrimitive } from "cmdk";
import { Plus, X } from "lucide-react";
import { useCreate, useNotify } from "ra-core";
import { useRef, useState, type KeyboardEvent } from "react";

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type { Etiqueta } from "../domain/types";
import { EtiquetaChip } from "./EtiquetaChip";
import { PUNTO_ETIQUETA } from "./estiloEtiqueta";
import { useEtiquetas, useRefrescarEtiquetas } from "./useEtiquetas";

const LARGO_MAXIMO = 40;
const VALOR_CREAR = "__crear__";

const limpiar = (texto: string) => texto.trim().replace(/\s+/g, " ");
// Evita que el clic en una opción le saque el foco al buscador
const mantenerFoco = (evento: { preventDefault: () => void }) =>
  evento.preventDefault();

export interface SelectorEtiquetasProps {
  value: readonly number[];
  onChange: (ids: number[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  // Los pasa <FormControl> para enlazar la etiqueta y el error
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

/**
 * Varias etiquetas con su color: se eligen del catálogo escribiendo y, si lo
 * escrito no existe, se crea ahí mismo ("Crear «…»").
 */
export const SelectorEtiquetas = ({
  value,
  onChange,
  onBlur,
  placeholder = "Agregar etiqueta…",
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalido,
  "aria-label": ariaLabel,
}: SelectorEtiquetasProps) => {
  const { etiquetas, porId, isPending } = useEtiquetas();
  const refrescar = useRefrescarEtiquetas();
  const notify = useNotify();
  const [crear, { isPending: creando }] = useCreate<Etiqueta>();
  const [texto, setTexto] = useState("");
  const [enfocado, setEnfocado] = useState(false);
  // Esc o clic afuera cierran la lista hasta que se vuelva a escribir
  const [descartada, setDescartada] = useState(false);
  // Creadas acá mientras el catálogo se vuelve a pedir
  const [creadas, setCreadas] = useState<Etiqueta[]>([]);
  const anclaRef = useRef<HTMLDivElement>(null);

  const buscar = (etiquetaId: number) =>
    porId.get(etiquetaId) ??
    creadas.find((etiqueta) => etiqueta.id === etiquetaId);
  const elegidas = value.flatMap((etiquetaId) => buscar(etiquetaId) ?? []);
  const disponibles = etiquetas.filter(
    (etiqueta) => !value.includes(etiqueta.id),
  );
  const buscado = limpiar(texto);
  const yaExiste = [...etiquetas, ...creadas].some(
    (etiqueta) => etiqueta.nombre.toLowerCase() === buscado.toLowerCase(),
  );
  const ofrecerCrear = buscado !== "" && !yaExiste && !isPending;
  const muyLarga = buscado.length > LARGO_MAXIMO;
  const abierto =
    enfocado && !descartada && (disponibles.length > 0 || ofrecerCrear);

  // Solo ids que siguen existiendo (una etiqueta borrada se descarta sola)
  const cambiar = (ids: number[]) =>
    onChange(
      isPending ? ids : ids.filter((cada) => buscar(cada) !== undefined),
    );
  const agregar = (etiquetaId: number) => {
    cambiar([...value, etiquetaId]);
    setTexto("");
  };
  const quitar = (etiquetaId: number) =>
    cambiar(value.filter((cada) => cada !== etiquetaId));

  const crearEtiqueta = async () => {
    if (creando || muyLarga) return;
    try {
      const nueva = await crear(
        "etiquetas",
        { data: { nombre: buscado } },
        { returnPromise: true },
      );
      if (nueva) {
        setCreadas((previas) => [...previas, nueva]);
        onChange([...value, nueva.id]);
        setTexto("");
      }
      void refrescar();
    } catch (error) {
      // Puede que otro usuario la haya creado recién: que aparezca en la lista
      void refrescar();
      notify(
        error instanceof Error ? error.message : "No se pudo crear la etiqueta",
        { type: "error" },
      );
    }
  };

  const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === "Backspace" && texto === "" && value.length) {
      quitar(value[value.length - 1]);
    }
  };

  return (
    <Command
      onKeyDown={alTeclear}
      className="h-auto overflow-visible bg-transparent"
    >
      <Popover
        open={abierto}
        onOpenChange={(abrir) => {
          if (!abrir) setDescartada(true);
        }}
      >
        <PopoverAnchor asChild>
          <div
            ref={anclaRef}
            className={cn(
              "flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
              invalido &&
                "border-destructive ring-destructive/20 dark:ring-destructive/40",
            )}
          >
            {elegidas.map((etiqueta) => (
              <EtiquetaChip
                key={etiqueta.id}
                nombre={etiqueta.nombre}
                color={etiqueta.color}
              >
                <button
                  type="button"
                  className="-mr-1 ml-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onMouseDown={mantenerFoco}
                  onClick={() => quitar(etiqueta.id)}
                  aria-label={`Quitar la etiqueta ${etiqueta.nombre}`}
                >
                  <X className="size-3" />
                </button>
              </EtiquetaChip>
            ))}
            <CommandPrimitive.Input
              id={id}
              value={texto}
              onValueChange={(valor) => {
                setTexto(valor);
                setDescartada(false);
              }}
              onFocus={() => {
                setEnfocado(true);
                setDescartada(false);
              }}
              onBlur={() => {
                setEnfocado(false);
                onBlur?.();
              }}
              placeholder={elegidas.length ? undefined : placeholder}
              aria-label={ariaLabel}
              aria-describedby={describedBy}
              aria-invalid={invalido}
              className="h-7 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-1"
          onOpenAutoFocus={(evento) => evento.preventDefault()}
          onCloseAutoFocus={(evento) => evento.preventDefault()}
          onInteractOutside={(evento) => {
            if (anclaRef.current?.contains(evento.target as Node)) {
              evento.preventDefault();
            }
          }}
        >
          <CommandList className="max-h-60">
            <CommandGroup>
              {disponibles.map((etiqueta) => (
                <CommandItem
                  key={etiqueta.id}
                  // El nombre es único (sin distinguir mayúsculas): sirve de valor y de búsqueda
                  value={etiqueta.nombre}
                  onMouseDown={mantenerFoco}
                  onSelect={() => agregar(etiqueta.id)}
                  className="cursor-pointer"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      PUNTO_ETIQUETA[etiqueta.color],
                    )}
                  />
                  <span className="truncate">{etiqueta.nombre}</span>
                </CommandItem>
              ))}
              {ofrecerCrear && (
                <CommandItem
                  forceMount
                  value={VALOR_CREAR}
                  disabled={creando || muyLarga}
                  onMouseDown={mantenerFoco}
                  onSelect={() => void crearEtiqueta()}
                  className="cursor-pointer"
                >
                  {creando ? <Spinner className="size-4" /> : <Plus />}
                  <span className="truncate">
                    {muyLarga
                      ? `Máximo ${LARGO_MAXIMO} caracteres`
                      : `Crear «${buscado}»`}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  );
};
