import {
  CircleCheckBig,
  Hourglass,
  Percent,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { ChartCard } from "../dashboard/ChartCard";
import {
  formatMoneda,
  formatNumero,
  formatPorcentaje,
  plural,
} from "../domain/format";
import { MOTIVOS_PERDIDA, nombreDe } from "../domain/options";
import type { VentasReporte } from "../domain/types";
import { BarrasHorizontales, type BarraDato } from "./BarrasHorizontales";
import { useVentasReporte, type FiltrosVentas } from "./filtrosVentas";

const dias = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? "—"
    : `${formatNumero(valor)} ${valor === 1 ? "día" : "días"}`;

const porcentaje = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? "—" : formatPorcentaje(valor);

// ----------------------------------------------------------------------------
// Indicadores
// ----------------------------------------------------------------------------

interface IndicadorProps {
  titulo: string;
  valor: string;
  detalle: string;
  Icono: LucideIcon;
}

const Indicador = ({ titulo, valor, detalle, Icono }: IndicadorProps) => (
  <Card className="gap-1 p-5">
    <span className="flex items-center justify-between text-sm text-muted-foreground">
      {titulo}
      <Icono aria-hidden className="size-4" />
    </span>
    <span className="truncate text-2xl font-semibold tracking-tight tabular-nums">
      {valor}
    </span>
    <span className="text-xs text-muted-foreground">{detalle}</span>
  </Card>
);

const Indicadores = ({
  datos,
}: {
  datos: VentasReporte["indicadores"] | undefined;
}) => {
  if (!datos) {
    return (
      <>
        {Array.from({ length: 5 }, (_, indice) => (
          <Skeleton key={indice} className="h-28 rounded-xl" />
        ))}
      </>
    );
  }
  const indicadores: IndicadorProps[] = [
    {
      titulo: "Total vendido",
      valor: formatMoneda(datos.total_vendido),
      detalle: "Suma de las ganadas del período",
      Icono: Wallet,
    },
    {
      titulo: "Ventas",
      valor: formatNumero(datos.ventas),
      detalle: "Oportunidades ganadas",
      Icono: CircleCheckBig,
    },
    {
      titulo: "Ticket promedio",
      valor:
        datos.ticket_promedio === null
          ? "—"
          : formatMoneda(datos.ticket_promedio),
      detalle: "Importe promedio por venta",
      Icono: Receipt,
    },
    {
      titulo: "Ciclo promedio",
      valor: dias(datos.ciclo_promedio),
      detalle: "Del alta al cierre de cada venta",
      Icono: Hourglass,
    },
    {
      titulo: "Tasa de cierre",
      valor: porcentaje(datos.tasa_cierre),
      detalle: `${plural(datos.ventas, "ganada", "ganadas")} de ${plural(datos.ventas + datos.perdidas, "cerrada", "cerradas")}`,
      Icono: Percent,
    },
  ];
  return (
    <>
      {indicadores.map((indicador) => (
        <Indicador key={indicador.titulo} {...indicador} />
      ))}
    </>
  );
};

// ----------------------------------------------------------------------------
// Tablas (alternativa accesible de cada gráfico)
// ----------------------------------------------------------------------------

interface ColumnaTabla<T> {
  titulo: string;
  numero?: boolean;
  valor: (fila: T) => ReactNode;
}

const TablaSimple = <T,>({
  filas,
  columnas,
  clave,
  vacio,
}: {
  filas: T[];
  columnas: ColumnaTabla<T>[];
  clave: (fila: T) => string;
  vacio: string;
}) =>
  filas.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          {columnas.map((columna) => (
            <TableHead
              key={columna.titulo}
              scope="col"
              className={columna.numero ? "text-right" : undefined}
            >
              {columna.titulo}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila) => (
          <TableRow key={clave(fila)}>
            {columnas.map((columna) => (
              <TableCell
                key={columna.titulo}
                className={
                  columna.numero ? "text-right tabular-nums" : undefined
                }
              >
                {columna.valor(fila)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <p className="py-6 text-center text-sm text-muted-foreground">{vacio}</p>
  );

// ----------------------------------------------------------------------------
// Secciones
// ----------------------------------------------------------------------------

type Canal = VentasReporte["por_canal"][number];
type ProductoVendido = VentasReporte["productos"][number];
type Motivo = VentasReporte["motivos"][number];
type Vendedor = VentasReporte["ranking"][number];

const SIN_VENTAS = "No hay ventas ganadas con estos filtros.";

const barraCanal = (canal: Canal): BarraDato => ({
  id: String(canal.canal_id ?? "sin"),
  etiqueta: canal.nombre,
  valor: Number(canal.importe),
  texto: `${formatMoneda(canal.importe)} · ${plural(canal.ventas, "venta", "ventas")}`,
  detalle: [
    formatMoneda(canal.importe),
    plural(canal.ventas, "venta", "ventas"),
  ],
});

const MAXIMO_PRODUCTOS_GRAFICO = 10;
type OrdenProductos = "importe" | "cantidad";

/** Los 10 primeros, por importe o por cantidad vendida. */
const GraficoProductos = ({ productos }: { productos: ProductoVendido[] }) => {
  const [orden, setOrden] = useState<OrdenProductos>("importe");
  const datos = [...productos]
    .sort((a, b) => Number(b[orden]) - Number(a[orden]))
    .slice(0, MAXIMO_PRODUCTOS_GRAFICO)
    .map((producto): BarraDato => ({
      id: String(producto.producto_id),
      etiqueta: producto.nombre,
      valor: Number(producto[orden]),
      texto:
        orden === "importe"
          ? formatMoneda(producto.importe)
          : `${formatNumero(producto.cantidad)} u.`,
      detalle: [
        formatMoneda(producto.importe),
        `${formatNumero(producto.cantidad)} unidades`,
        `En ${plural(producto.ventas, "venta", "ventas")}`,
      ],
    }));

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={orden}
        onValueChange={(valor) => valor && setOrden(valor as OrdenProductos)}
        aria-label="Ordenar productos por"
      >
        <ToggleGroupItem value="importe">Por importe</ToggleGroupItem>
        <ToggleGroupItem value="cantidad">Por cantidad</ToggleGroupItem>
      </ToggleGroup>
      <BarrasHorizontales datos={datos} vacio={SIN_VENTAS} />
    </div>
  );
};

const barraMotivo = (motivo: Motivo): BarraDato => {
  const nombre = nombreDe(MOTIVOS_PERDIDA, motivo.motivo);
  return {
    id: motivo.motivo,
    etiqueta: nombre,
    valor: motivo.cantidad,
    texto: plural(motivo.cantidad, "perdida", "perdidas"),
    detalle: [
      plural(motivo.cantidad, "oportunidad perdida", "oportunidades perdidas"),
      `${formatMoneda(motivo.importe)} sin vender`,
    ],
  };
};

const Ranking = ({
  datos,
  isPending,
  error,
}: {
  datos: Vendedor[];
  isPending: boolean;
  error: unknown;
}) => (
  <Card>
    <CardHeader className="space-y-1">
      <CardTitle className="text-base">Ranking de vendedores</CardTitle>
      <p className="text-sm text-muted-foreground">
        Por importe vendido. Con varios responsables, cada uno suma la venta
        completa: el ranking puede sumar más que el total.
      </p>
    </CardHeader>
    <CardContent>
      {isPending ? (
        <Skeleton className="h-40 w-full" aria-label="Cargando" />
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          No se pudo cargar el ranking.
        </p>
      ) : (
        <TablaSimple<Vendedor>
          filas={datos}
          clave={(vendedor) => vendedor.usuario_id}
          vacio="No hay oportunidades cerradas con estos filtros."
          columnas={[
            {
              titulo: "#",
              valor: (vendedor) => datos.indexOf(vendedor) + 1,
            },
            { titulo: "Vendedor", valor: (vendedor) => vendedor.nombre },
            {
              titulo: "Importe",
              numero: true,
              valor: (vendedor) => formatMoneda(vendedor.importe),
            },
            {
              titulo: "Ventas",
              numero: true,
              valor: (vendedor) => vendedor.ventas,
            },
            {
              titulo: "Tasa de cierre",
              numero: true,
              valor: (vendedor) => porcentaje(vendedor.tasa_cierre),
            },
            {
              titulo: "Ciclo",
              numero: true,
              valor: (vendedor) => dias(vendedor.ciclo_promedio),
            },
          ]}
        />
      )}
    </CardContent>
  </Card>
);

/** Indicadores, canales, ranking, productos y motivos de pérdida. */
export const VentasReportes = ({ filtros }: { filtros: FiltrosVentas }) => {
  const { data, isPending, error } = useVentasReporte(filtros);
  const comunes = { isPending, error };

  if (error && !data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No se pudieron cargar los reportes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <Indicadores datos={data?.indicadores} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          {...comunes}
          titulo="Ventas por canal"
          descripcion="Importe ganado según por dónde llegó la oportunidad."
          grafico={
            <BarrasHorizontales
              datos={(data?.por_canal ?? []).map(barraCanal)}
              vacio={SIN_VENTAS}
            />
          }
          tabla={
            <TablaSimple<Canal>
              filas={data?.por_canal ?? []}
              clave={(canal) => String(canal.canal_id ?? "sin")}
              vacio={SIN_VENTAS}
              columnas={[
                { titulo: "Canal", valor: (canal) => canal.nombre },
                {
                  titulo: "Ventas",
                  numero: true,
                  valor: (canal) => canal.ventas,
                },
                {
                  titulo: "Importe",
                  numero: true,
                  valor: (canal) => formatMoneda(canal.importe),
                },
              ]}
            />
          }
        />
        <Ranking datos={data?.ranking ?? []} {...comunes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          {...comunes}
          titulo="Productos más vendidos"
          descripcion="Los 10 primeros de las ventas ganadas (la tabla tiene todos)."
          grafico={<GraficoProductos productos={data?.productos ?? []} />}
          tabla={
            <TablaSimple<ProductoVendido>
              filas={data?.productos ?? []}
              clave={(producto) => String(producto.producto_id)}
              vacio={SIN_VENTAS}
              columnas={[
                { titulo: "Producto", valor: (producto) => producto.nombre },
                {
                  titulo: "Cantidad",
                  numero: true,
                  valor: (producto) => formatNumero(producto.cantidad),
                },
                {
                  titulo: "Ventas",
                  numero: true,
                  valor: (producto) => producto.ventas,
                },
                {
                  titulo: "Importe",
                  numero: true,
                  valor: (producto) => formatMoneda(producto.importe),
                },
              ]}
            />
          }
        />
        <ChartCard
          {...comunes}
          titulo="Motivos de pérdida"
          descripcion="Oportunidades perdidas en el período, por motivo."
          grafico={
            <BarrasHorizontales
              datos={(data?.motivos ?? []).map(barraMotivo)}
              vacio="No hay oportunidades perdidas con estos filtros."
            />
          }
          tabla={
            <TablaSimple<Motivo>
              filas={data?.motivos ?? []}
              clave={(motivo) => motivo.motivo}
              vacio="No hay oportunidades perdidas con estos filtros."
              columnas={[
                {
                  titulo: "Motivo",
                  valor: (motivo) => nombreDe(MOTIVOS_PERDIDA, motivo.motivo),
                },
                {
                  titulo: "Perdidas",
                  numero: true,
                  valor: (motivo) => motivo.cantidad,
                },
                {
                  titulo: "Importe",
                  numero: true,
                  valor: (motivo) => formatMoneda(motivo.importe),
                },
              ]}
            />
          }
        />
      </div>
    </div>
  );
};
