import { useId, type ReactNode } from "react";

/** Grupo de campos de un formulario con su título, separado del anterior (el primero, sin línea). */
export const SeccionFormulario = ({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) => {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0"
    >
      <h3
        id={id}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {titulo}
      </h3>
      {children}
    </div>
  );
};
