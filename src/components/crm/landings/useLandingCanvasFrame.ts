import { useCallback, useEffect, useRef } from "react";

import {
  CANVAS_STYLES,
  type CanvasChromeContext,
  decorateCanvas,
} from "./landingCanvasChrome";
import type { CanvasTextSpot } from "./landingCanvasPaths";

/** Where the caret goes in a text the editor moves to. */
export type CaretAt = "end" | "all";

/** The page's own header is not fixed on the canvas: a small margin is enough. */
const SCROLL_MARGIN_PX = 12;

/** True while a text of the canvas has the caret: rewriting it would lose it. */
export const isTyping = (doc: Document) =>
  doc.hasFocus() && !!doc.activeElement?.closest("[data-edit]");

export const findTextElement = (doc: Document, spot: CanvasTextSpot) =>
  doc.querySelector<HTMLElement>(
    `[data-edit="${spot.path}"]${spot.line === undefined ? "" : `[data-line="${spot.line}"]`}`,
  );

export const placeCaret = (element: HTMLElement, caret: CaretAt) => {
  const doc = element.ownerDocument;
  const selection = doc.getSelection();
  if (!selection) return;
  const range = doc.createRange();
  range.selectNodeContents(element);
  if (caret === "end") range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

export const scrollCanvasTo = (doc: Document, anchor: string) => {
  const view = doc.defaultView;
  const target = doc.getElementById(anchor);
  if (!view || !target) return;
  // Not scrollIntoView: it would also scroll the panes around the frame
  view.scrollTo({
    top: target.getBoundingClientRect().top + view.scrollY - SCROLL_MARGIN_PX,
    behavior: "smooth",
  });
};

/**
 * Writes the page into the canvas, without ever pulling the text being typed
 * from under the caret: while a text is edited, or the pointer is down on the
 * canvas, the newest page waits and is written right after.
 */
export const useLandingCanvasFrame = (
  doc: Document | null,
  html: string,
  context: CanvasChromeContext,
) => {
  const pending = useRef<{ html: string; context: CanvasChromeContext }>(null);
  const writtenHead = useRef("");
  const pointerIsDown = useRef(false);
  const focusNext = useRef<{ spot: CanvasTextSpot; caret: CaretAt }>(null);
  const scrollNext = useRef<string>(null);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!doc || !next || pointerIsDown.current || isTyping(doc)) return;
    pending.current = null;
    const parsed = new DOMParser().parseFromString(next.html, "text/html");
    if (writtenHead.current !== parsed.head.innerHTML) {
      writtenHead.current = parsed.head.innerHTML;
      doc.head.innerHTML = `${parsed.head.innerHTML}<style>${CANVAS_STYLES}</style>`;
    }
    doc.body.innerHTML = parsed.body.innerHTML;
    decorateCanvas(doc, next.context);

    const focus = focusNext.current;
    focusNext.current = null;
    const element = focus && findTextElement(doc, focus.spot);
    if (focus && element) {
      element.focus();
      placeCaret(element, focus.caret);
    }
    if (scrollNext.current) {
      scrollCanvasTo(doc, scrollNext.current);
      scrollNext.current = null;
    }
  }, [doc]);

  useEffect(() => {
    pending.current = { html, context };
    flush();
  }, [html, context, flush]);

  // Whatever waited is written once the caret or the pointer lets go
  const flushSoon = useCallback(() => {
    window.setTimeout(flush, 0);
  }, [flush]);

  useEffect(() => {
    if (!doc) return;
    const press = () => {
      pointerIsDown.current = true;
    };
    const release = () => {
      if (!pointerIsDown.current) return;
      pointerIsDown.current = false;
      flushSoon();
    };
    doc.addEventListener("pointerdown", press, true);
    doc.addEventListener("pointerup", release, true);
    doc.addEventListener("pointercancel", release, true);
    doc.addEventListener("focusout", flushSoon);
    // A press that ends outside the frame is let go there
    window.addEventListener("pointerup", release);
    return () => {
      doc.removeEventListener("pointerdown", press, true);
      doc.removeEventListener("pointerup", release, true);
      doc.removeEventListener("pointercancel", release, true);
      doc.removeEventListener("focusout", flushSoon);
      window.removeEventListener("pointerup", release);
    };
  }, [doc, flushSoon]);

  /** After the next write, puts the caret in this text. */
  const focusAfterWrite = useCallback(
    (spot: CanvasTextSpot, caret: CaretAt = "end") => {
      focusNext.current = { spot, caret };
    },
    [],
  );

  /** Scrolls to this part of the page, now or after the next write. */
  const scrollTo = useCallback(
    (anchor: string, afterWrite = false) => {
      if (afterWrite || !doc) {
        scrollNext.current = anchor;
        return;
      }
      scrollCanvasTo(doc, anchor);
    },
    [doc],
  );

  return { focusAfterWrite, scrollTo };
};
