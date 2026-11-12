import { Plus, Trash2 } from "lucide-react";
import { maxValue, minValue, required } from "ra-core";
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";

import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { NumberInput } from "@/components/admin/number-input";
import { Button } from "@/components/ui/button";

import { formatMoneda } from "../domain/format";
import { useProductos } from "../productos/useProductos";
import {
  LINEA_VACIA,
  subtotalDe,
  type LineaFormulario,
} from "./lineasProductos";

const validarCantidad = [
  required(),
  minValue(0.01, "La cantidad tiene que ser mayor a 0"),
];
const validarPrecio = [
  required(),
  minValue(0, "El precio no puede ser negativo"),
];
const validarDescuento = [
  minValue(0, "Entre 0 y 100"),
  maxValue(100, "Entre 0 y 100"),
];

/**
 * Productos de la oportunidad: una línea por producto (cantidad, precio
 * unitario y descuento). El importe es la suma de los subtotales y el título
 * se arma con los nombres; los dos los calcula la base al guardar.
 */
export const LineasProductosInput = () => {
  const { control, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "productos",
    rules: {
      validate: (lineas) =>
        lineas.length > 0 ? true : "Agregá al menos un producto",
    },
  });
  const lineas = (useWatch({ name: "productos" }) ?? []) as LineaFormulario[];
  const { activos, porId } = useProductos();
  const { errors } = useFormState({ name: "productos" });
  const error = errors.productos as
    { message?: string; root?: { message?: string } } | undefined;
  const mensajeError = error?.root?.message ?? error?.message;

  const total = lineas.reduce((suma, linea) => suma + subtotalDe(linea), 0);

  /** Activos que no están en otra línea, más el de esta línea (aunque esté inactivo). */
  const opcionesDe = (indice: number) => {
    const actual = lineas[indice];
    const usados = new Set(
      lineas
        .filter((_, otro) => otro !== indice)
        .map((linea) => linea.producto_id),
    );
    const opciones = activos
      .filter((producto) => !usados.has(producto.id))
      .map((producto) => ({ id: producto.id, name: producto.nombre }));
    const elegido = actual?.producto_id;
    if (elegido && !opciones.some((opcion) => opcion.id === elegido)) {
      const producto = porId.get(elegido);
      opciones.unshift({
        id: elegido,
        name: `${producto?.nombre ?? actual.nombre ?? "Producto"}${
          producto && !producto.activo ? " (inactivo)" : ""
        }`,
      });
    }
    return opciones;
  };

  return (
    <div role="group" aria-label="Productos" className="space-y-3">
      {fields.map((field, indice) => (
        <div
          key={field.id}
          className="space-y-3 rounded-lg border bg-muted/30 p-3"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <AutocompleteInput
                source={`productos.${indice}.producto_id`}
                label="Producto"
                choices={opcionesDe(indice)}
                translateChoice={false}
                validate={required()}
                onChange={(id: unknown) => {
                  const producto = porId.get(Number(id));
                  if (producto) {
                    setValue(
                      `productos.${indice}.precio_unitario`,
                      producto.precio,
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-6 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Quitar el producto ${indice + 1}`}
              onClick={() => remove(indice)}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_minmax(0,1fr)_6rem_minmax(0,1fr)]">
            <NumberInput
              source={`productos.${indice}.cantidad`}
              label="Cantidad"
              min={0}
              step={1}
              validate={validarCantidad}
            />
            <NumberInput
              source={`productos.${indice}.precio_unitario`}
              label="Precio unitario"
              min={0}
              step={0.01}
              validate={validarPrecio}
            />
            <NumberInput
              source={`productos.${indice}.descuento`}
              label="Desc. %"
              min={0}
              max={100}
              validate={validarDescuento}
            />
            <div className="flex flex-col justify-start gap-2">
              <span className="text-sm font-medium">Subtotal</span>
              <output
                className="flex h-9 items-center justify-end text-sm font-medium tabular-nums"
                aria-live="polite"
              >
                {formatMoneda(subtotalDe(lineas[indice]))}
              </output>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ ...LINEA_VACIA })}
        >
          <Plus />
          Agregar producto
        </Button>
        <p className="text-sm">
          <span className="text-muted-foreground">Importe total </span>
          <span className="text-base font-semibold tabular-nums">
            {formatMoneda(total)}
          </span>
        </p>
      </div>
      {mensajeError && (
        <p role="alert" className="text-sm text-destructive">
          {mensajeError}
        </p>
      )}
    </div>
  );
};
