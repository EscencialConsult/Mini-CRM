import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Mismo contrato que un ícono de lucide para el menú: solo `className`. */
export type IconoMarca = ComponentType<{ className?: string }>;

/**
 * Íconos propios del menú: trazo redondeado de 1.7px sobre 24×24, en línea con
 * el isotipo (curvas suaves, sin esquinas duras). Heredan `currentColor`.
 */
const crear = (trazos: ReactNode): IconoMarca =>
  function IconoDeMarca({ className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn("size-5 shrink-0", className)}
      >
        {trazos}
      </svg>
    );
  };

export const IconoInicio = crear(
  <>
    <path d="M3.5 11.2 12 4l8.5 7.2" />
    <path d="M5.5 9.8V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.8" />
    <path d="M10 20v-4.5a2 2 0 0 1 4 0V20" />
  </>,
);

export const IconoClientes = crear(
  <>
    <circle cx="9" cy="8.2" r="3.2" />
    <path d="M3.5 19.5c0-3.3 2.5-5.3 5.5-5.3s5.5 2 5.5 5.3" />
    <path d="M15.4 5.3a2.7 2.7 0 0 1 0 5.2" />
    <path d="M17 14.4c2.1.5 3.5 2.2 3.5 5.1" />
  </>,
);

export const IconoOportunidades = crear(
  <>
    <rect x="3.5" y="4" width="5" height="12" rx="1.6" />
    <rect x="9.5" y="4" width="5" height="16" rx="1.6" />
    <rect x="15.5" y="4" width="5" height="8" rx="1.6" />
  </>,
);

export const IconoPedidos = crear(
  <>
    <path d="M5.5 8h13l-1 11.2a1 1 0 0 1-1 .8H7.5a1 1 0 0 1-1-.8L5.5 8Z" />
    <path d="M9 8V7a3 3 0 0 1 6 0v1" />
  </>,
);

export const IconoVentas = crear(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 6.8v10.4" />
    <path d="M14.5 9.5c-.5-.7-1.3-1.1-2.5-1.1-1.4 0-2.4.7-2.4 1.8 0 2.4 5 1.1 5 3.6 0 1.1-1.1 1.9-2.6 1.9-1.2 0-2.2-.5-2.7-1.3" />
  </>,
);

export const IconoActividades = crear(
  <>
    <path d="m4 7 1.7 1.7L9 5.4" />
    <path d="M12.5 7H20" />
    <path d="m4 16 1.7 1.7L9 14.4" />
    <path d="M12.5 16H20" />
  </>,
);

export const IconoLandings = crear(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z" />
  </>,
);

export const IconoCuentas = crear(
  <>
    <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20" />
    <path d="M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V20" />
    <path d="M3.5 20h17" />
    <path d="M8.5 8h3M8.5 12h3" />
  </>,
);

export const IconoUsuarios = crear(
  <>
    <circle cx="10" cy="8.2" r="3.2" />
    <path d="M3.5 19.5c0-3.3 2.6-5.3 6.5-5.3" />
    <circle cx="17.5" cy="16.5" r="1.8" />
    <path d="M17.5 12.7v1M17.5 19.3v1M13.7 16.5h1M20.3 16.5h1" />
  </>,
);

export const IconoProductos = crear(
  <>
    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
    <path d="m4 8 8 4.5L20 8" />
    <path d="M12 12.5v8" />
  </>,
);

export const IconoCanales = crear(
  <>
    <path d="M4 10.5v3a1 1 0 0 0 1 1h2.5L16 19V5L7.5 9.5H5a1 1 0 0 0-1 1Z" />
    <path d="M19.5 9.5c.9.7 1.4 1.5 1.4 2.5s-.5 1.8-1.4 2.5" />
    <path d="m8 14.5 1 4.5h2.2l-.8-3.6" />
  </>,
);

export const IconoEtiquetas = crear(
  <>
    <path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h6.2c.4 0 .8.16 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-6.7 6.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3a1.5 1.5 0 0 1-.44-1.06V5.5Z" />
    <circle cx="8" cy="8.5" r="1.2" />
  </>,
);

export const IconoAuditoria = crear(
  <>
    <path d="M6 3.5h8.5L19 8v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h5" />
    <path d="M8.5 12.5h7M8.5 16h5" />
  </>,
);
