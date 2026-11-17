import { useCreate, useCreateSuggestionContext, useNotify } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { validarTelefono } from "../domain/validators";
import type { Cliente, TipoCliente } from "../domain/types";

const Campo = ({
  id,
  etiqueta,
  error,
  ...props
}: { id: string; etiqueta: string; error?: string } & React.ComponentProps<
  typeof Input
>) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{etiqueta}</Label>
    <Input id={id} aria-invalid={!!error} {...props} />
    {error && (
      <p role="alert" className="text-xs text-destructive">
        {error}
      </p>
    )}
  </div>
);

/**
 * Alta rápida de cliente desde un selector («+ Crear "Juan"»): nombre y un dato
 * de contacto alcanzan; el resto se completa después en Clientes. Queda a nombre
 * de quien lo carga (la base lo asigna). Va como `create` de un AutocompleteInput.
 *
 * No usa <form>: el selector vive dentro de otro formulario y un submit del
 * diálogo burbujearía hasta él.
 */
export const ClienteRapidoCrear = () => {
  const { filter, onCancel, onCreate } = useCreateSuggestionContext();
  const [crear, { isPending }] = useCreate<Cliente>();
  const notify = useNotify();

  const [tipo, setTipo] = useState<TipoCliente>("persona");
  const partes = (filter ?? "").trim().split(/\s+/).filter(Boolean);
  const [nombre, setNombre] = useState(
    partes.length > 1 ? partes.slice(0, -1).join(" ") : (partes[0] ?? ""),
  );
  const [apellido, setApellido] = useState(
    partes.length > 1 ? (partes.at(-1) ?? "") : "",
  );
  const [razonSocial, setRazonSocial] = useState(filter ?? "");
  const [telefono, setTelefono] = useState("");
  const [intento, setIntento] = useState(false);

  const faltaNombre = tipo === "empresa" ? !razonSocial.trim() : !nombre.trim();
  const errorTelefono = validarTelefono(telefono);

  const guardar = async () => {
    setIntento(true);
    if (faltaNombre || errorTelefono) return;
    try {
      const cliente = await crear(
        "clientes",
        {
          data:
            tipo === "empresa"
              ? {
                  tipo,
                  razon_social: razonSocial.trim(),
                  telefono: telefono.trim() || null,
                }
              : {
                  tipo,
                  nombre: nombre.trim(),
                  apellido: apellido.trim() || null,
                  telefono: telefono.trim() || null,
                },
        },
        { returnPromise: true },
      );
      notify("Cliente creado", { type: "success" });
      onCreate(cliente);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo crear el cliente",
        { type: "error" },
      );
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCancel()}>
      <DialogContent
        onKeyDown={(evento) => {
          if (
            evento.key === "Enter" &&
            evento.target instanceof HTMLInputElement
          ) {
            evento.preventDefault();
            void guardar();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Cargá lo básico para seguir con la oportunidad. Después podés
            completar el resto desde Clientes.
          </DialogDescription>
        </DialogHeader>

        <ToggleGroup
          type="single"
          variant="outline"
          value={tipo}
          onValueChange={(valor) => valor && setTipo(valor as TipoCliente)}
          aria-label="Tipo de cliente"
          className="w-fit"
        >
          <ToggleGroupItem value="persona" className="min-h-10 px-4">
            Persona
          </ToggleGroupItem>
          <ToggleGroupItem value="empresa" className="min-h-10 px-4">
            Empresa
          </ToggleGroupItem>
        </ToggleGroup>

        {tipo === "empresa" ? (
          <Campo
            id="cr-razon"
            etiqueta="Razón social *"
            value={razonSocial}
            autoFocus
            onChange={(evento) => setRazonSocial(evento.target.value)}
            error={intento && faltaNombre ? "Campo obligatorio" : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="cr-nombre"
              etiqueta="Nombre *"
              value={nombre}
              autoFocus
              onChange={(evento) => setNombre(evento.target.value)}
              error={intento && faltaNombre ? "Campo obligatorio" : undefined}
            />
            <Campo
              id="cr-apellido"
              etiqueta="Apellido"
              value={apellido}
              onChange={(evento) => setApellido(evento.target.value)}
            />
          </div>
        )}
        <Campo
          id="cr-telefono"
          etiqueta="Teléfono"
          type="tel"
          inputMode="tel"
          value={telefono}
          onChange={(evento) => setTelefono(evento.target.value)}
          error={intento ? errorTelefono : undefined}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            loading={isPending}
            onClick={() => void guardar()}
          >
            Crear cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
