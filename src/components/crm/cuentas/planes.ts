import type { Modulo } from "../domain/modulos";

export interface PlanComercial {
  id: string;
  nombre: string;
  modulos: Modulo[];
  /** Máximo de usuarios activos de la cuenta. */
  maxUsuarios: number;
}

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
  { id: "prueba", nombre: "Prueba", modulos: PRUEBA, maxUsuarios: 2 },
  { id: "esencial", nombre: "Esencial", modulos: ESENCIAL, maxUsuarios: 3 },
  {
    id: "profesional",
    nombre: "Profesional",
    modulos: PROFESIONAL,
    maxUsuarios: 5,
  },
  {
    id: "acompanado",
    nombre: "Acompañado",
    modulos: ACOMPANADO,
    maxUsuarios: 10,
  },
];
