import get from "lodash/get";
import { Save } from "lucide-react";
import { Form, setSubmissionErrors, useSaveContext } from "ra-core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormContext, useFormState } from "react-hook-form";

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

/** Avisa al pie que un guardado alternativo está en curso (el spinner va en ese botón). */
const GuardadoAlternativo = createContext<(activo: boolean) => void>(
  () => undefined,
);

interface GuardarConProps {
  etiqueta: string;
  icono: ReactNode;
  variante?: ComponentProps<typeof Button>["variant"];
  /** Valores que se suman a los del formulario al guardar. */
  valores: Record<string, unknown>;
}

/**
 * Otro botón de guardado del modal ("Completar", "Reabrir"…): valida y guarda
 * el formulario con algunos valores cambiados, en un solo pedido.
 */
export const GuardarCon = ({
  etiqueta,
  icono,
  variante = "outline",
  valores,
}: GuardarConProps) => {
  const form = useFormContext();
  const { save } = useSaveContext();
  const { isSubmitting } = useFormState();
  const marcarActivo = useContext(GuardadoAlternativo);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    marcarActivo(true);
    try {
      await form.handleSubmit(async (datos) => {
        const errores = await save?.({ ...datos, ...valores });
        if (errores != null) setSubmissionErrors(errores, form.setError);
      })();
    } finally {
      setGuardando(false);
      marcarActivo(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variante}
      loading={guardando}
      disabled={isSubmitting}
      onClick={() => void guardar()}
    >
      {icono}
      {etiqueta}
    </Button>
  );
};

const Pie = ({
  info,
  acciones,
  guardadosExtra,
  submitLabel,
  onCancel,
}: {
  info?: ReactNode;
  acciones?: ReactNode;
  guardadosExtra?: ReactNode;
  submitLabel: string;
  onCancel: () => void;
}) => {
  const { isSubmitting } = useFormState();
  const [alternativoActivo, setAlternativoActivo] = useState(false);

  return (
    // Fuera del área con scroll: queda fijo, sin saltos al llegar al final
    <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-6 py-3 sm:flex-row sm:items-center">
      {info && (
        <div className="min-w-0 text-xs text-muted-foreground sm:flex-1">
          {info}
        </div>
      )}
      {/* Una sola fila; en móvil, si no entran, bajan a otra */}
      <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto sm:shrink-0 sm:flex-nowrap">
        {acciones}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <GuardadoAlternativo.Provider value={setAlternativoActivo}>
          {guardadosExtra}
        </GuardadoAlternativo.Provider>
        <Button
          type="submit"
          loading={isSubmitting && !alternativoActivo}
          disabled={isSubmitting}
        >
          <Save />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

interface RecordFormProps {
  children: ReactNode;
  defaultValues?: Record<string, unknown>;
  onCancel: () => void;
  submitLabel?: string;
  /** Contenido a la izquierda de los botones (por ejemplo, la autoría). */
  footerInfo?: ReactNode;
  /** Botones junto a Cancelar, a su izquierda (eliminar…). */
  footerActions?: ReactNode;
  /** Otros guardados (<GuardarCon>), entre Cancelar y Guardar. */
  extraSaves?: ReactNode;
}

/** Formulario de alta/edición dentro de un modal. Va dentro de CreateBase o EditBase. */
export const RecordForm = ({
  children,
  defaultValues,
  onCancel,
  submitLabel = "Guardar",
  footerInfo,
  footerActions,
  extraSaves,
}: RecordFormProps) => (
  <Form
    mode="onBlur"
    reValidateMode="onChange"
    defaultValues={defaultValues}
    className="flex min-h-0 flex-1 flex-col"
  >
    <LimpiarErrorAlCorregir />
    {/* Solo los campos scrollean; el pie queda abajo, fijo */}
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto bg-background px-6 py-5">
      {children}
    </div>
    <Pie
      info={footerInfo}
      acciones={footerActions}
      guardadosExtra={extraSaves}
      submitLabel={submitLabel}
      onCancel={onCancel}
    />
  </Form>
);
