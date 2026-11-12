import { Navigate, useStore } from "ra-core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { rutaInicial, tieneModulo, type Modulo } from "../domain/modulos";
import { useCrmIdentity } from "../providers/authProvider";
import { Embudo } from "./Embudo";
import { Indicadores } from "./Indicadores";
import { PERIODOS, rangoDePeriodo, type PeriodoId } from "./periodos";
import { Seguimiento } from "./Seguimiento";
import { VentasPorMes } from "./VentasPorMes";

const SinModulos = () => (
  <div className="mx-auto max-w-md space-y-2 py-16 text-center">
    <h1 className="text-xl font-semibold tracking-tight">
      Todavía no tenés módulos asignados
    </h1>
    <p className="text-sm text-muted-foreground">
      Pedile a un administrador que te habilite las partes del CRM que vas a
      usar.
    </p>
  </div>
);

/**
 * Panel de control: cada sección carga y falla por separado, y solo aparecen
 * las de los módulos que el usuario tiene. Sin el módulo Panel, lleva a la
 * primera pantalla que puede abrir.
 */
const Dashboard = () => {
  const { identity } = useCrmIdentity();
  const [periodo, setPeriodo] = useStore<PeriodoId>(
    "panel.periodo",
    "mes_actual",
  );
  const rango = rangoDePeriodo(periodo);

  if (!identity) return null;
  if (!tieneModulo(identity, "panel")) {
    const destino = rutaInicial(identity);
    return destino ? <Navigate to={destino} replace /> : <SinModulos />;
  }
  const tiene = (modulo: Modulo) => tieneModulo(identity, modulo);
  const conOportunidades = tiene("oportunidades");

  return (
    <div className="space-y-6 py-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Panel de control
          </h1>
          {identity && (
            <p className="text-sm text-muted-foreground">
              Hola, {identity.fullName}.
            </p>
          )}
        </div>
        <Select
          value={periodo}
          onValueChange={(valor) => setPeriodo(valor as PeriodoId)}
        >
          <SelectTrigger
            aria-label="Período de los indicadores"
            className="w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((opcion) => (
              <SelectItem key={opcion.id} value={opcion.id}>
                {opcion.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Indicadores rango={rango} />

      {conOportunidades && (
        <div className="grid gap-6 lg:grid-cols-2">
          <VentasPorMes />
          <Embudo />
        </div>
      )}

      {(tiene("actividades") || tiene("clientes")) && <Seguimiento />}
    </div>
  );
};

export default Dashboard;
