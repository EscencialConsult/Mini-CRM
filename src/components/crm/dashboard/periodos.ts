import { aIsoFecha } from "../domain/format";

export type PeriodoId =
  "mes_actual" | "mes_anterior" | "ultimos_30" | "anio" | "ultimos_12";

export interface Periodo {
  id: PeriodoId;
  name: string;
}

export const PERIODOS: Periodo[] = [
  { id: "mes_actual", name: "Este mes" },
  { id: "mes_anterior", name: "Mes anterior" },
  { id: "ultimos_30", name: "Últimos 30 días" },
  { id: "anio", name: "Este año" },
];

export interface RangoFechas {
  desde: string;
  hasta: string;
}

/** Rango [desde, hasta] (ambos inclusive, "YYYY-MM-DD" en hora local) de un período. */
export const rangoDePeriodo = (
  id: PeriodoId,
  hoy: Date = new Date(),
): RangoFechas => {
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  switch (id) {
    case "mes_anterior":
      return {
        desde: aIsoFecha(new Date(anio, mes - 1, 1)),
        hasta: aIsoFecha(new Date(anio, mes, 0)),
      };
    case "ultimos_30":
      return {
        desde: aIsoFecha(new Date(anio, mes, hoy.getDate() - 29)),
        hasta: aIsoFecha(hoy),
      };
    case "anio":
      return { desde: aIsoFecha(new Date(anio, 0, 1)), hasta: aIsoFecha(hoy) };
    case "ultimos_12":
      return {
        desde: aIsoFecha(new Date(anio - 1, mes, hoy.getDate() + 1)),
        hasta: aIsoFecha(hoy),
      };
    case "mes_actual":
    default:
      return {
        desde: aIsoFecha(new Date(anio, mes, 1)),
        hasta: aIsoFecha(hoy),
      };
  }
};
