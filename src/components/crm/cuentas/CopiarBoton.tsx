import { Check, Copy } from "lucide-react";
import { useNotify } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Copia un texto al portapapeles y lo confirma un momento. */
export const CopiarBoton = ({
  texto,
  etiqueta = "Copiar",
  deshabilitado,
  className,
}: {
  texto: string;
  etiqueta?: string;
  deshabilitado?: boolean;
  className?: string;
}) => {
  const notify = useNotify();
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      notify("No se pudo copiar: seleccionalo y copialo a mano", {
        type: "error",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(className)}
      disabled={deshabilitado || !texto}
      onClick={() => void copiar()}
    >
      {copiado ? <Check /> : <Copy />}
      {copiado ? "Copiado" : etiqueta}
    </Button>
  );
};
