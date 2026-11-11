import { useNotify } from "ra-core";

/** Aviso estándar de guardado exitoso. */
export const useAvisoGuardado = () => {
  const notify = useNotify();
  return (mensaje: string) => notify(mensaje, { type: "success" });
};
