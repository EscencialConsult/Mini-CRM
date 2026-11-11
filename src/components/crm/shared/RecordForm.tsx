import get from "lodash/get";
import { Form } from "ra-core";
import { useEffect, useRef, type ReactNode } from "react";
import { useFormContext, useFormState } from "react-hook-form";

import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";

/**
 * Los campos se validan al salir (blur). Si un campo ya muestra error, se
 * revalida al escribir solo para quitarlo en cuanto queda válido.
 */
const LimpiarErrorAlCorregir = () => {
  const { watch, trigger } = useFormContext();
  const { errors } = useFormState();
  const erroresRef = useRef(errors);
  erroresRef.current = errors;

  useEffect(() => {
    const suscripcion = watch((_valores, { name, type }) => {
      if (name && type === "change" && get(erroresRef.current, name)) {
        void trigger(name);
      }
    });
    return () => suscripcion.unsubscribe();
  }, [watch, trigger]);

  return null;
};

interface RecordFormProps {
  children: ReactNode;
  defaultValues?: Record<string, unknown>;
  onCancel: () => void;
  submitLabel?: string;
  /** Contenido a la izquierda de los botones (por ejemplo, la autoría). */
  footerInfo?: ReactNode;
}

/** Formulario de alta/edición dentro de un modal. Va dentro de CreateBase o EditBase. */
export const RecordForm = ({
  children,
  defaultValues,
  onCancel,
  submitLabel = "Guardar",
  footerInfo,
}: RecordFormProps) => (
  <Form
    mode="onBlur"
    reValidateMode="onChange"
    defaultValues={defaultValues}
    className="flex flex-col"
  >
    <LimpiarErrorAlCorregir />
    <div className="grid gap-4 px-6 py-5">{children}</div>
    <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-background px-6 py-3">
      {footerInfo && (
        <div className="mr-auto min-w-0 text-xs text-muted-foreground">
          {footerInfo}
        </div>
      )}
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <SaveButton label={submitLabel} />
    </div>
  </Form>
);
