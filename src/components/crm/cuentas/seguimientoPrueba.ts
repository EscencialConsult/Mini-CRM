/**
 * El mensaje de WhatsApp para preguntarle a quien terminó su prueba gratis si le
 * interesó seguir. Va armado; quien lo manda puede cambiarlo antes de enviar.
 */
export const mensajeSeguimientoPrueba = ({
  nombre,
  empresa,
}: {
  /** Cómo llamar a la persona (el nombre del titular). */
  nombre: string;
  /** La cuenta, si tiene un nombre que distinga a la empresa. */
  empresa?: string;
}) =>
  [
    `Hola ${nombre.trim() || "¿cómo estás?"}, soy de Dealflow. Terminó tu prueba gratis${
      empresa?.trim() ? ` de ${empresa.trim()}` : ""
    }.`,
    "",
    "¿Qué te pareció? ¿Te interesa seguir con un plan? Si querés, te cuento las opciones y te dejo la cuenta activa hoy mismo.",
  ].join("\n");
