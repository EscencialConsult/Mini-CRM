import { useWatch } from "react-hook-form";

import { SelectInputOpcional } from "../shared/SelectInputOpcional";
import { useCanales } from "./useCanales";

/** Selector de canal (`canal_id`): los activos más el que ya tenga el registro. */
export const CanalInput = ({
  label,
  helperText,
}: {
  label: string;
  helperText?: string;
}) => {
  const actual = useWatch({ name: "canal_id" }) as number | null | undefined;
  const { opcionesPara } = useCanales();

  return (
    <SelectInputOpcional
      source="canal_id"
      label={label}
      choices={opcionesPara(actual)}
      translateChoice={false}
      emptyText="Sin canal"
      parse={(valor: string) => (valor === "" ? null : Number(valor))}
      helperText={helperText}
    />
  );
};
