import {
  SelectInput,
  type SelectInputProps,
} from "@/components/admin/select-input";

const vacioANulo = (valor: string): string | null =>
  valor === "" ? null : valor;

/** Select con opción vacía: elegirla guarda `null` (por ejemplo, "Sin asignar"). */
export const SelectInputOpcional = ({
  emptyText = "Sin asignar",
  ...props
}: SelectInputProps) => (
  <SelectInput emptyText={emptyText} parse={vacioANulo} {...props} />
);
