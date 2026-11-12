import { useStore } from "ra-core";
import { useMemo } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { filtroListado, useFiltrosVentas } from "./filtrosVentas";
import { FiltrosVentasBarra } from "./FiltrosVentasBarra";
import { VentasListado } from "./VentasListado";
import { VentasReportes } from "./VentasReportes";

type Vista = "reportes" | "listado";

/**
 * Sección Ventas (módulo Ventas): reportes y listado de las ganadas, con los
 * mismos filtros (período de cierre, vendedor, canal y producto).
 */
export const VentasPage = () => {
  const [filtros, setFiltros] = useFiltrosVentas();
  const [vista, setVista] = useStore<Vista>("ventas.vista", "reportes");
  const filtro = useMemo(() => filtroListado(filtros), [filtros]);

  return (
    <section className="space-y-4 py-2">
      <header className="space-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Oportunidades ganadas y cómo se llegó a ellas, según la fecha de
          cierre.
        </p>
      </header>
      <FiltrosVentasBarra filtros={filtros} onCambiar={setFiltros} />
      <Tabs
        value={vista}
        onValueChange={(valor) => setVista(valor as Vista)}
        className="gap-4"
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="reportes" className="px-3">
            Reportes
          </TabsTrigger>
          <TabsTrigger value="listado" className="px-3">
            Listado
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reportes">
          <VentasReportes filtros={filtros} />
        </TabsContent>
        <TabsContent value="listado">
          <VentasListado filtro={filtro} />
        </TabsContent>
      </Tabs>
    </section>
  );
};
