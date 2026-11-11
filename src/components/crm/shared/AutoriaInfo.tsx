import { formatFechaHora } from "../domain/format";

interface AutoriaInfoProps {
  creado_en?: string;
  creado_por_nombre?: string | null;
  actualizado_en?: string;
  actualizado_por_nombre?: string | null;
  /** Sin usuario: de dónde vino el alta ("la landing «Cursos»"). */
  creado_desde?: string | null;
}

/** Quién creó y quién modificó por última vez el registro. */
export const AutoriaInfo = ({
  creado_en,
  creado_por_nombre,
  actualizado_en,
  actualizado_por_nombre,
  creado_desde,
}: AutoriaInfoProps) => {
  if (!creado_en) return null;
  const modificado = actualizado_en && actualizado_en !== creado_en;
  return (
    <>
      <span className="block">
        {!creado_por_nombre && creado_desde
          ? `Creado desde ${creado_desde}`
          : `Creado por ${creado_por_nombre ?? "usuario eliminado"}`}{" "}
        · {formatFechaHora(creado_en)}
      </span>
      {modificado && (
        <span className="block">
          Modificado por {actualizado_por_nombre ?? "usuario eliminado"} ·{" "}
          {formatFechaHora(actualizado_en)}
        </span>
      )}
    </>
  );
};
