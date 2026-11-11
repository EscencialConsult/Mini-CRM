import { useListContext, type Identifier, type RaRecord } from "ra-core";

/**
 * Selección de los registros en pantalla. Lo elegido en otra página o
 * pestaña no cuenta: las acciones nunca tocan filas que no se ven.
 */
export const useSeleccionLista = <T extends RaRecord>() => {
  const { data, selectedIds, onSelect, onToggleItem } = useListContext<T>();
  const visibles = data ?? [];
  const idsVisibles = visibles.map((registro) => registro.id);
  const seleccionados = visibles.filter((registro) =>
    selectedIds.includes(registro.id),
  );
  const todos = visibles.length > 0 && seleccionados.length === visibles.length;

  return {
    seleccionados,
    todos,
    algunos: seleccionados.length > 0 && !todos,
    estaSeleccionado: (id: Identifier) => selectedIds.includes(id),
    alternar: (id: Identifier) => onToggleItem(id),
    alternarTodos: () =>
      onSelect(
        todos
          ? selectedIds.filter((id) => !idsVisibles.includes(id))
          : [...new Set([...selectedIds, ...idsVisibles])],
      ),
    limpiar: () => onSelect([]),
  };
};
