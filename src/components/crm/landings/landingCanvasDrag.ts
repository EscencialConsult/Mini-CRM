/** How close to an edge of the canvas the page starts scrolling while dragging. */
const SCROLL_EDGE_PX = 64;
/** The tallest the copy that follows the pointer gets, as a share of the canvas. */
const GHOST_MAX_HEIGHT = 0.4;

/**
 * A copy of the section that follows the pointer up and down, shrunk around
 * the grabbed point so it never hides where it lands. `.ed-ghost` reads the
 * variables set here.
 */
const createGhost = (
  section: HTMLElement,
  event: PointerEvent,
  viewHeight: number,
) => {
  const doc = section.ownerDocument;
  const box = section.getBoundingClientRect();
  const grabY = event.clientY - box.top;
  const copy = section.cloneNode(true) as HTMLElement;
  // Nothing reaches the copy, and no id of the page is repeated
  [copy, ...copy.querySelectorAll("[id]")].forEach((element) =>
    element.removeAttribute("id"),
  );
  const ghost = doc.createElement("div");
  ghost.className = "ed-ghost";
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  ghost.append(copy);
  const scale = Math.min(
    1,
    (viewHeight * GHOST_MAX_HEIGHT) / Math.max(box.height, 1),
  );
  ghost.style.setProperty("--ghost-w", `${box.width}px`);
  ghost.style.setProperty("--ghost-x", `${box.left}px`);
  ghost.style.setProperty("--ghost-y", `${box.top}px`);
  ghost.style.setProperty("--grab-x", `${event.clientX - box.left}px`);
  ghost.style.setProperty("--grab-y", `${grabY}px`);
  ghost.style.setProperty("--ghost-scale", String(scale));
  doc.body.append(ghost);

  let drawnY = event.clientY;
  return {
    moveTo: (pointerY: number) => {
      if (pointerY === drawnY) return;
      drawnY = pointerY;
      ghost.style.setProperty("--ghost-y", `${pointerY - grabY}px`);
    },
    remove: () => ghost.remove(),
  };
};

/**
 * Drags a section by its handle: a copy of it follows the pointer, a line
 * shows where it lands, the page scrolls near the edges and Esc cancels.
 * Reports the move as positions in the list.
 */
export const startSectionDrag = ({
  doc,
  handle,
  event,
  onDrop,
}: {
  doc: Document;
  handle: HTMLElement;
  event: PointerEvent;
  onDrop: (from: number, to: number) => void;
}) => {
  const view = doc.defaultView;
  const dragged = handle.closest<HTMLElement>("[data-section]");
  const sections = [...doc.querySelectorAll<HTMLElement>("[data-section]")];
  if (!view || !dragged || sections.length < 2) return;

  event.preventDefault();
  const from = sections.indexOf(dragged);
  let target = from;
  let pointerY = event.clientY;
  let frame = 0;

  const line = doc.createElement("div");
  line.className = "ed-drop";
  doc.body.append(line);
  const ghost = createGhost(dragged, event, view.innerHeight);
  dragged.classList.add("ed-dragging");
  doc.documentElement.classList.add("ed-is-dragging");
  handle.setPointerCapture(event.pointerId);

  const place = () => {
    const boxes = sections.map((section) => section.getBoundingClientRect());
    const found = boxes.findIndex((box) => pointerY < box.top + box.height / 2);
    const slot = found === -1 ? boxes.length : found;
    const edge =
      slot < boxes.length ? boxes[slot].top : boxes[boxes.length - 1].bottom;
    line.style.setProperty("--drop-y", `${edge + view.scrollY}px`);
    target = slot > from ? slot - 1 : slot;
  };

  // The parent window runs the loop: the canvas itself runs no scripts
  const follow = () => {
    if (pointerY < SCROLL_EDGE_PX) {
      view.scrollBy(0, -(SCROLL_EDGE_PX - pointerY) / 3);
    } else if (pointerY > view.innerHeight - SCROLL_EDGE_PX) {
      view.scrollBy(0, (pointerY - view.innerHeight + SCROLL_EDGE_PX) / 3);
    }
    place();
    ghost.moveTo(pointerY);
    frame = window.requestAnimationFrame(follow);
  };

  const move = (next: PointerEvent) => {
    pointerY = next.clientY;
  };
  const finish = (drop: boolean) => {
    window.cancelAnimationFrame(frame);
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", release);
    handle.removeEventListener("pointercancel", cancel);
    doc.removeEventListener("keydown", escape, true);
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    line.remove();
    ghost.remove();
    dragged.classList.remove("ed-dragging");
    doc.documentElement.classList.remove("ed-is-dragging");
    if (drop && target !== from) onDrop(from, target);
  };
  const release = () => finish(true);
  const cancel = () => finish(false);
  const escape = (key: KeyboardEvent) => {
    if (key.key !== "Escape") return;
    key.preventDefault();
    finish(false);
  };

  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", cancel);
  doc.addEventListener("keydown", escape, true);
  follow();
};
