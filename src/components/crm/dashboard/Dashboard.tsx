import { useStore } from "ra-core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCrmIdentity } from "../providers/authProvider";
import { Embudo } from "./Embudo";
import { Indicadores } from "./Indicadores";
import { PERIODOS, rangoDePeriodo, type PeriodoId } from "./periodos";
import { Seguimiento } from "./Seguimiento";
import { VentasPorMes } from "./VentasPorMes";

/** Panel de control: cada sección carga y falla por separado. */
const Dashboard = () => {
  const { identity } = useCrmIdentity();
  const [periodo, setPeriodo] = useStore<PeriodoId>(
    "panel.periodo",
    "mes_actual",
  );
  const rango = rangoDePeriodo(periodo);

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

      <div className="grid gap-6 lg:grid-cols-2">
        <VentasPorMes />
        <Embudo />
      </div>

      <Seguimiento />
    </div>
  );
};

export default Dashboard;
