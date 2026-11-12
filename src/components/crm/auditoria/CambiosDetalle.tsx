import { useCanales } from "../canales/useCanales";
import {
  formatFecha,
  formatFechaHora,
  formatMoneda,
  formatNumero,
} from "../domain/format";
import { nombreModulo } from "../domain/modulos";
import { MOTIVOS_PERDIDA, nombreDe as nombreOpcion } from "../domain/options";
import type { LineaProducto, RegistroAuditoria } from "../domain/types";
import { useEtiquetas } from "../etiquetas/useEtiquetas";
import { useUsuarios } from "../shared/useUsuarios";
import { CAMPOS_OCULTOS, ETIQUETAS_CAMPO } from "./textoAuditoria";

interface CambioCampo {
  antes: unknown;
  despues: unknown;
}

const esCambio = (valor: unknown): valor is CambioCampo =>
  typeof valor === "object" &&
  valor !== null &&
  "antes" in valor &&
  "despues" in valor;

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const INSTANTE_ISO = /^\d{4}-\d{2}-\d{2}T/;

/** "2 × Producto A ($ 1.000, 10 % desc.)". */
const textoLinea = (linea: Partial<LineaProducto>): string => {
  const descuento = Number(linea.descuento) || 0;
  return `${formatNumero(Number(linea.cantidad) || 0)} × ${linea.nombre ?? "Producto"} (${formatMoneda(linea.precio_unitario)}${
    descuento ? `, ${formatNumero(descuento)} % desc.` : ""
  })`;
};

/** Muestra un valor guardado de forma legible (fechas, sí/no, responsables, etiquetas). */
const useFormateadorValor = () => {
  const { usuarios } = useUsuarios();
  const { porId: etiquetasPorId } = useEtiquetas();
  const { porId: canalesPorId } = useCanales();
  const nombreDe = (id: unknown) => {
    const usuario = usuarios.find((candidato) => candidato.id === id);
    return usuario ? `${usuario.nombre} ${usuario.apellido}` : "Otro usuario";
  };
  return (campo: string, valor: unknown): string => {
    if (valor === null || valor === undefined || valor === "") return "—";
    if (typeof valor === "boolean") return valor ? "Sí" : "No";
    if (campo === "asignado_a" && typeof valor === "string") {
      return nombreDe(valor);
    }
    // Varios responsables (oportunidades y tareas)
    if (campo === "asignados" && Array.isArray(valor)) {
      return valor.length ? valor.map(nombreDe).join(", ") : "Sin asignar";
    }
    if (campo === "modulos" && Array.isArray(valor)) {
      return valor.length
        ? valor.map((id) => nombreModulo(String(id))).join(", ")
        : "Ninguno";
    }
    if (campo === "etiquetas" && Array.isArray(valor)) {
      return valor.length
        ? valor
            .map((id) => etiquetasPorId.get(Number(id))?.nombre ?? "Borrada")
            .join(", ")
        : "Sin etiquetas";
    }
    if (campo === "productos" && Array.isArray(valor)) {
      return valor.length
        ? (valor as Partial<LineaProducto>[]).map(textoLinea).join(" · ")
        : "Sin productos";
    }
    if (campo === "canal_id") {
      return canalesPorId.get(Number(valor))?.nombre ?? "Canal borrado";
    }
    if (campo === "importe_estimado") return formatMoneda(Number(valor));
    if (campo === "motivo_perdida_tipo") {
      return nombreOpcion(MOTIVOS_PERDIDA, String(valor));
    }
    if (typeof valor === "string" && FECHA_ISO.test(valor))
      return formatFecha(valor);
    if (typeof valor === "string" && INSTANTE_ISO.test(valor)) {
      return formatFechaHora(valor);
    }
    return String(valor);
  };
};

/** Detalle de qué cambió: "campo: antes → después" (edición) o los datos del registro. */
export const CambiosDetalle = ({
  registro,
}: {
  registro: RegistroAuditoria;
}) => {
  const formatear = useFormateadorValor();
  const cambios = registro.cambios;
  if (!cambios) return null;

  const filas = Object.entries(cambios).filter(
    ([campo, valor]) =>
      !CAMPOS_OCULTOS.has(campo) &&
      (registro.accion === "editar" ? esCambio(valor) : valor !== null),
  );
  if (!filas.length) return null;

  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
      {filas.map(([campo, valor]) => (
        <div key={campo} className="contents">
          <dt className="text-muted-foreground">
            {ETIQUETAS_CAMPO[campo] ?? campo}
          </dt>
          <dd>
            {esCambio(valor) ? (
              <>
                <span className="text-muted-foreground line-through">
                  {formatear(campo, valor.antes)}
                </span>
                {" → "}
                <span className="font-medium">
                  {formatear(campo, valor.despues)}
                </span>
              </>
            ) : (
              formatear(campo, valor)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};
