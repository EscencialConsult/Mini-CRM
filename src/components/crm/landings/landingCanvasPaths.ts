import type { LandingContent } from "./pagina/schema.ts";

/**
 * Where a text of the canvas is stored, as the renderer marks it: a path like
 * "sections.2.items.0.title", and for the lines of a plan, which line it is.
 */
export interface CanvasTextSpot {
  path: string;
  /** One line of a text kept with line breaks */
  line?: number;
  /** One entry of a list of texts, like a highlight of the hero */
  entry?: boolean;
}

type Node = Record<string, unknown> | unknown[];

const isNode = (value: unknown): value is Node =>
  !!value && typeof value === "object";

const walk = (root: unknown, keys: string[]): unknown =>
  keys.reduce<unknown>(
    (node, key) =>
      isNode(node) ? (node as Record<string, unknown>)[key] : undefined,
    root,
  );

const splitPath = (path: string) => {
  const keys = path.split(".");
  const last = keys.pop() ?? "";
  return { keys, last };
};

export const readText = (content: LandingContent, path: string): string => {
  const value = walk(content, path.split("."));
  return typeof value === "string" ? value : "";
};

/** Only replaces a text that exists, or adds the next entry of a list. */
export const writeText = (
  draft: LandingContent,
  path: string,
  value: string,
) => {
  const { keys, last } = splitPath(path);
  const parent = walk(draft, keys);
  if (Array.isArray(parent)) {
    const index = Number(last);
    if (Number.isInteger(index) && index >= 0 && index <= parent.length) {
      parent[index] = value;
    }
    return;
  }
  if (!isNode(parent)) return;
  const record = parent as Record<string, unknown>;
  if (typeof record[last] === "string") record[last] = value;
};

const listOf = (draft: LandingContent, spot: CanvasTextSpot) => {
  if (spot.line !== undefined) {
    return { items: readText(draft, spot.path).split("\n"), index: spot.line };
  }
  const { keys, last } = splitPath(spot.path);
  const list = walk(draft, keys);
  return Array.isArray(list) && list.every((item) => typeof item === "string")
    ? { items: list as string[], index: Number(last) }
    : undefined;
};

const saveList = (
  draft: LandingContent,
  spot: CanvasTextSpot,
  items: string[],
) => {
  if (spot.line !== undefined) writeText(draft, spot.path, items.join("\n"));
};

export const writeSpot = (
  draft: LandingContent,
  spot: CanvasTextSpot,
  value: string,
) => {
  if (spot.line === undefined) {
    writeText(draft, spot.path, value);
    return;
  }
  const list = listOf(draft, spot);
  if (!list) return;
  list.items[list.index] = value;
  saveList(draft, spot, list.items);
};

/** The spot of another position of the same list. */
export const siblingSpot = (
  spot: CanvasTextSpot,
  index: number,
): CanvasTextSpot =>
  spot.line !== undefined
    ? { ...spot, line: index }
    : { ...spot, path: `${splitPath(spot.path).keys.join(".")}.${index}` };

export const spotIndex = (spot: CanvasTextSpot) =>
  spot.line ?? Number(splitPath(spot.path).last);

/** How many entries or lines the list of this spot has. */
export const countSiblings = (content: LandingContent, spot: CanvasTextSpot) =>
  listOf(content, spot)?.items.length ?? 0;

/** Adds an empty entry or line after this one. */
export const insertAfter = (draft: LandingContent, spot: CanvasTextSpot) => {
  const list = listOf(draft, spot);
  if (!list) return;
  // The canvas offers a first entry before the list has any
  while (list.items.length <= list.index) list.items.push("");
  list.items.splice(list.index + 1, 0, "");
  saveList(draft, spot, list.items);
};

/** Removes this entry or line, when there is another one to keep. */
export const removeSpot = (draft: LandingContent, spot: CanvasTextSpot) => {
  const list = listOf(draft, spot);
  if (!list || list.items.length < 2) return;
  list.items.splice(list.index, 1);
  saveList(draft, spot, list.items);
};

/** The key that groups the typing in one text into one step to undo. */
export const spotKey = (spot: CanvasTextSpot) =>
  spot.line === undefined ? spot.path : `${spot.path}#${spot.line}`;

export const moveItem = <T>(list: T[], from: number, to: number) => {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
};
