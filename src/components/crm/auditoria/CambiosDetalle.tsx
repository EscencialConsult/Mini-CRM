import { formatFecha, formatFechaHora } from "../domain/format";
import type { RegistroAuditoria } from "../domain/types";
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

/** Muestra un valor guardado de forma legible (fechas, sí/no, responsables). */
const useFormateadorValor = () => {
  const { usuarios } = useUsuarios();
  return (campo: string, valor: unknown): string => {
    if (valor === null || valor === undefined || valor === "") return "—";
    if (typeof valor === "boolean") return valor ? "Sí" : "No";
    if (campo === "asignado_a" && typeof valor === "string") {
      const usuario = usuarios.find((candidato) => candidato.id === valor);
      return usuario ? `${usuario.nombre} ${usuario.apellido}` : "Otro usuario";
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
