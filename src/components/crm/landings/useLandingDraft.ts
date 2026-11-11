import { useCallback, useReducer } from "react";

import type { LandingContent } from "./pagina/schema.ts";
import type { PatchLanding } from "./landingControls";

const HISTORY_LIMIT = 100;
/** Typing in the same text within this time is one step to undo. */
const MERGE_WINDOW_MS = 1200;

interface DraftState {
  content: LandingContent;
  past: LandingContent[];
  future: LandingContent[];
  mergeKey?: string;
  mergeAt: number;
}

type DraftAction =
  | {
      type: "patch";
      recipe: (draft: LandingContent) => void;
      mergeKey?: string;
      at: number;
    }
  | { type: "undo" }
  | { type: "redo" };

const reducer = (state: DraftState, action: DraftAction): DraftState => {
  switch (action.type) {
    case "patch": {
      const content = structuredClone(state.content);
      action.recipe(content);
      const merges =
        !!action.mergeKey &&
        action.mergeKey === state.mergeKey &&
        action.at - state.mergeAt < MERGE_WINDOW_MS;
      return {
        content,
        past: merges
          ? state.past
          : [...state.past, state.content].slice(-HISTORY_LIMIT),
        future: [],
        mergeKey: action.mergeKey,
        mergeAt: action.at,
      };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        content: previous,
        past: state.past.slice(0, -1),
        future: [state.content, ...state.future],
        mergeAt: 0,
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return {
        content: next,
        past: [...state.past, state.content],
        future,
        mergeAt: 0,
      };
    }
  }
};

/**
 * The content being edited, with undo and redo. Recipes run on a copy and must
 * only change it: nothing outside can depend on when they run.
 */
export const useLandingDraft = (
  initial: () => LandingContent,
  onChange: () => void,
) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    content: initial(),
    past: [],
    future: [],
    mergeAt: 0,
  }));

  const patch = useCallback<PatchLanding>(
    (recipe, options) => {
      dispatch({
        type: "patch",
        recipe,
        mergeKey: options?.mergeKey,
        at: Date.now(),
      });
      onChange();
    },
    [onChange],
  );

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const undo = useCallback(() => {
    if (!canUndo) return;
    dispatch({ type: "undo" });
    onChange();
  }, [canUndo, onChange]);
  const redo = useCallback(() => {
    if (!canRedo) return;
    dispatch({ type: "redo" });
    onChange();
  }, [canRedo, onChange]);

  return { content: state.content, patch, undo, redo, canUndo, canRedo };
};
