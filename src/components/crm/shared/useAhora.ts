import { useEffect, useState } from "react";

/**
 * La hora actual (en milisegundos), refrescada cada `cadaMs`. Sirve para que algo
 * que vence —la prueba gratis de una cuenta— se corte solo en pantalla, sin
 * esperar a que el usuario cambie de página.
 */
export const useAhora = (cadaMs = 30_000): number => {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const temporizador = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(temporizador);
  }, [cadaMs]);
  return ahora;
};
