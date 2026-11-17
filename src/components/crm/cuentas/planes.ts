import type { Modulo } from "../domain/modulos";

export interface PlanComercial {
  id: string;
  nombre: string;
  modulos: Modulo[];
  /** Máximo de usuarios activos de la cuenta. */
  maxUsuarios: number;
  /** Precio mensual de referencia, en pesos (0 = gratis). */
  precio: number;
  /** Qué suma respecto del plan anterior, en una línea. */
  resumen: string;
}

/** Cada usuario de más se suma subiendo el máximo de la cuenta. */
export const PRECIO_USUARIO_EXTRA = 30000;

const PRUEBA: Modulo[] = ["panel", "clientes", "oportunidades", "actividades"];
const ESENCIAL: Modulo[] = [
  ...PRUEBA,
  "productos",
  "ventas",
  "etiquetas",
  "importacion",
];
const PROFESIONAL: Modulo[] = [...ESENCIAL, "landings", "pedidos"];
const ACOMPANADO: Modulo[] = [...PROFESIONAL, "auditoria", "asistente"];

/** Los planes de la propuesta comercial: lo que se tilda en cada cuenta. */
export const PLANES: readonly PlanComercial[] = [
  {
    id: "prueba",
    nombre: "Prueba",
    modulos: PRUEBA,
    maxUsuarios: 2,
    precio: 0,
    resumen: "Clientes, tablero, tareas y panel",
  },
  {
    id: "esencial",
    nombre: "Esencial",
    modulos: ESENCIAL,
    maxUsuarios: 3,
    precio: 110000,
    resumen: "Suma productos, ventas, etiquetas y carga masiva",
  },
  {
    id: "profesional",
    nombre: "Profesional",
    modulos: PROFESIONAL,
    maxUsuarios: 5,
    precio: 180000,
    resumen: "Suma landings y pedidos",
  },
  {
    id: "acompanado",
    nombre: "Acompañado",
    modulos: ACOMPANADO,
    maxUsuarios: 10,
    precio: 250000,
    resumen: "Suma auditoría y asistente",
  },
];

/**
 * El plan que describen estos módulos y este máximo, si coincide con uno: los
 * módulos de un plan, más (a lo sumo) «Asistente: altas», que se contrata aparte.
 */
export const planDe = (
  modulos: readonly Modulo[] | undefined,
  maxUsuarios: unknown,
): PlanComercial | undefined =>
  PLANES.find(
    (plan) =>
      Number(maxUsuarios) === plan.maxUsuarios &&
      plan.modulos.every((modulo) => modulos?.includes(modulo)) &&
      (modulos ?? []).every(
        (modulo) =>
          plan.modulos.includes(modulo) || modulo === "asistente_altas",
      ),
  );
