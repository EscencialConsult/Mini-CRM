import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { useNotify, useTranslate } from "ra-core";
import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { useElementSize } from "@/hooks/use-element-size";
import { cn } from "@/lib/utils";

import { useProductos } from "../productos/useProductos";
import { type ProductosVistaPrevia, renderLandingPage } from "./pagina/render.ts";
import {
  type LandingContent,
  type LandingSectionType,
  PLACEHOLDER_MARK,
} from "./pagina/schema.ts";
import type { CanvasAction } from "./landingCanvasChrome";
import { startSectionDrag } from "./landingCanvasDrag";
import { buildCanvasContext } from "./landingCanvasLabels";
import {
  type CanvasTextSpot,
  countSiblings,
  insertAfter,
  moveItem,
  readText,
  removeSpot,
  siblingSpot,
  spotIndex,
  spotKey,
  writeSpot,
  writeText,
} from "./landingCanvasPaths";
import {
  type CanvasPopoverState,
  FieldSettings,
  ImagePicker,
  LandingCanvasPopover,
  QuestionPicker,
  SectionPicker,
  VideoPicker,
} from "./LandingCanvasPopover";
import type { PatchLanding } from "./landingControls";
import { fieldFromPreset, type PresetQuestion } from "./landingQuestions";
import {
  emptyLandingItem,
  newLandingItemId,
  newLandingSection,
} from "./landingSections";
import { placeCaret, useLandingCanvasFrame } from "./useLandingCanvasFrame";

const DEVICE_WIDTHS = { desktop: 1280, mobile: 390 } as const;
type Device = keyof typeof DEVICE_WIDTHS;
const EMPTY_PAGE = "<!doctype html><html><head></head><body></body></html>";
const EDITOR = "resources.landings.editor";

export interface LandingCanvasHandle {
  /** Brings a part of the page into view; anchors are the `s-...` ids. */
  scrollTo: (anchor: string) => void;
}

/** The canvas is another document: its elements are not this window's Element. */
const closest = (target: EventTarget | null, selector: string) =>
  target && "closest" in target
    ? (target as Element).closest<HTMLElement>(selector)
    : null;

const spotOf = (element: HTMLElement): CanvasTextSpot => ({
  path: element.dataset.edit ?? "",
  line:
    element.dataset.line === undefined
      ? undefined
      : Number(element.dataset.line),
  entry: element.dataset.entry !== undefined,
});

const isListSpot = (spot: CanvasTextSpot) =>
  spot.line !== undefined || !!spot.entry;

/** The text as typed: one line, or with its line breaks. */
const typedText = (element: HTMLElement) => {
  const text = element.innerText;
  return element.dataset.multi === undefined
    ? text.replace(/\s*\n\s*/g, " ")
    : text.replace(/\n+$/, "");
};

/**
 * The page itself, edited in place: texts are typed where they are, sections
 * are dragged by their handle, and a click on an image, a video or a question
 * opens what changes it. Drawn at its real width and scaled to fit.
 */
export const LandingCanvas = ({
  content,
  slug,
  patch,
  readOnly,
  onUndo,
  onRedo,
  toolbar,
  ref,
}: {
  content: LandingContent;
  slug: string;
  patch: PatchLanding;
  /** The example editor has nowhere to upload images to */
  readOnly?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Controls shown before the device switch, like the style menu */
  toolbar?: ReactNode;
  ref?: Ref<LandingCanvasHandle>;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [device, setDevice] = useState<Device>("desktop");
  const [paneRef, pane] = useElementSize();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [popover, setPopover] = useState<CanvasPopoverState | null>(null);

  // The order block of the preview shows the real products, read through the
  // CRM (no public RPC is opened for it)
  const { activos, isPending: cargandoProductos, hayError } = useProductos();
  const productos = useMemo<ProductosVistaPrevia>(() => {
    if (cargandoProductos) return { estado: "cargando" };
    if (hayError) return { estado: "error" };
    return {
      estado: "listo",
      lista: activos.map(({ id, nombre, descripcion, precio }) => ({
        id,
        nombre,
        descripcion: descripcion ?? undefined,
        precio,
      })),
    };
  }, [activos, cargandoProductos, hayError]);
  const html = useMemo(
    () =>
      renderLandingPage(content, {
        slug,
        submitUrl: "",
        editable: true,
        productos,
      }),
    [content, slug, productos],
  );
  const context = useMemo(
    () => buildCanvasContext(content, translate),
    [content, translate],
  );
  const { focusAfterWrite, scrollTo } = useLandingCanvasFrame(
    doc,
    html,
    context,
  );
  useImperativeHandle(ref, () => ({ scrollTo }), [scrollTo]);

  // The listeners are attached once per document and read the newest values
  const latest = useRef({ content, patch, onUndo, onRedo, popover });
  useEffect(() => {
    latest.current = { content, patch, onUndo, onRedo, popover };
  });

  const addSection = (type: LandingSectionType, at: number) => {
    const section = newLandingSection(type);
    patch((draft) => {
      draft.sections.splice(at, 0, section);
    });
    focusAfterWrite({ path: `sections.${at}.title` }, "all");
    setPopover(null);
  };

  const addField = (preset: PresetQuestion) => {
    const at = content.form.fields.length;
    const field = fieldFromPreset(preset);
    patch((draft) => {
      draft.form.fields.push(field);
    });
    focusAfterWrite({ path: `form.fields.${at}.label` }, "all");
    setPopover(null);
  };

  useEffect(() => {
    if (!doc) return;
    const view = doc.defaultView;

    const openSlot = (slot: HTMLElement) => {
      const image = slot.dataset.image;
      const video = slot.dataset.video;
      if (image) {
        setPopover({
          kind: "image",
          path: image,
          anchor: `[data-image="${image}"]`,
        });
      } else if (video) {
        setPopover({
          kind: "video",
          path: video,
          anchor: `[data-video="${video}"]`,
        });
      }
    };

    const runAction = (button: HTMLElement) => {
      const { content, patch } = latest.current;
      const action = button.dataset.action as CanvasAction;
      const section = Number(
        closest(button, "[data-section]")?.dataset.section,
      );
      const item = Number(closest(button, "[data-item]")?.dataset.item);
      const field = Number(closest(button, "[data-field]")?.dataset.field);
      const moveSection = (to: number) => {
        patch((draft) => moveItem(draft.sections, section, to));
        scrollTo(`s-${content.sections[section].id}`, true);
      };
      switch (action) {
        case "section-up":
          return moveSection(section - 1);
        case "section-down":
          return moveSection(section + 1);
        case "section-toggle":
          return patch((draft) => {
            draft.sections[section].enabled = !draft.sections[section].enabled;
          });
        case "section-duplicate": {
          const copy = {
            ...structuredClone(content.sections[section]),
            id: newLandingItemId("s"),
          };
          patch((draft) => {
            draft.sections.splice(section + 1, 0, copy);
          });
          return scrollTo(`s-${copy.id}`, true);
        }
        case "section-remove":
          patch((draft) => {
            draft.sections.splice(section, 1);
          });
          return notify(`${EDITOR}.canvas.section_removed`, { type: "info" });
        case "section-insert": {
          const at = Number(button.dataset.at);
          return setPopover({
            kind: "add-section",
            at,
            anchor: `[data-action="section-insert"][data-at="${at}"]`,
          });
        }
        case "item-add": {
          const at = content.sections[section].items.length;
          patch((draft) => {
            draft.sections[section].items.push(emptyLandingItem());
          });
          return focusAfterWrite({
            path: `sections.${section}.items.${at}.title`,
          });
        }
        case "item-before":
        case "item-after":
          return patch((draft) =>
            moveItem(
              draft.sections[section].items,
              item,
              action === "item-before" ? item - 1 : item + 1,
            ),
          );
        case "item-remove":
          return patch((draft) => {
            draft.sections[section].items.splice(item, 1);
          });
        case "field-add":
          return setPopover({
            kind: "add-field",
            anchor: '[data-action="field-add"]',
          });
        case "field-before":
        case "field-after":
          return patch((draft) =>
            moveItem(
              draft.form.fields,
              field,
              action === "field-before" ? field - 1 : field + 1,
            ),
          );
        case "field-settings":
          return setPopover({
            kind: "field",
            index: field,
            anchor: `[data-field="${field}"]`,
          });
        case "field-remove":
          return patch((draft) => {
            draft.form.fields.splice(field, 1);
          });
      }
    };

    // What is left to complete is selected, so typing replaces it
    let selectTimer = 0;
    const selectTodo = (element: HTMLElement) => {
      const todo = element.querySelector<HTMLElement>("mark.landing-todo");
      if (doc.activeElement === element && todo) placeCaret(todo, "all");
    };

    // Nothing on the canvas navigates, toggles or submits
    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      // The canvas runs no script: the shop cards only say where to try them.
      // This is checked first so a click on them never selects a section or field.
      if (closest(event.target, "[data-cart-preview]")) {
        notify(`${EDITOR}.canvas.cart_preview`, { type: "info" });
        return;
      }
      const button = closest(event.target, "[data-action]");
      if (button) {
        runAction(button);
        return;
      }
      const text = closest(event.target, "[data-edit]");
      if (text) {
        // The click already placed the caret: a drag selection is kept
        if (doc.getSelection()?.isCollapsed) selectTodo(text);
        return;
      }
      const slot = closest(event.target, "[data-image],[data-video]");
      if (slot) {
        openSlot(slot);
        return;
      }
      const field = closest(event.target, "[data-field]");
      if (field) {
        setPopover({
          kind: "field",
          index: Number(field.dataset.field),
          anchor: `[data-field="${field.dataset.field}"]`,
        });
      }
    };

    const handleInput = (event: Event) => {
      const element = closest(event.target, "[data-edit]");
      if (!element) return;
      window.clearTimeout(selectTimer);
      const spot = spotOf(element);
      const value = typedText(element);
      // A text emptied by the browser keeps a stray break that hides its hint
      if (!element.innerText.replace(/\n/g, "")) element.replaceChildren();
      latest.current.patch((draft) => writeSpot(draft, spot, value), {
        mergeKey: spotKey(spot),
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const { content, patch, onUndo, onRedo } = latest.current;
      const element = closest(event.target, "[data-edit]");
      const key = event.key.toLowerCase();
      if (!element) {
        const command = event.ctrlKey || event.metaKey;
        if (command && (key === "z" || key === "y")) {
          event.preventDefault();
          if (key === "y" || event.shiftKey) onRedo();
          else onUndo();
          return;
        }
        const slot = closest(event.target, "[data-image],[data-video]");
        if (slot && (key === "enter" || key === " ")) {
          event.preventDefault();
          openSlot(slot);
        }
        return;
      }
      if (key === "escape") {
        element.blur();
        return;
      }
      const spot = spotOf(element);
      if (key === "enter" && element.dataset.multi === undefined) {
        event.preventDefault();
        if (isListSpot(spot)) {
          patch((draft) => insertAfter(draft, spot));
          focusAfterWrite(siblingSpot(spot, spotIndex(spot) + 1));
        }
        element.blur();
        return;
      }
      if (
        key === "backspace" &&
        isListSpot(spot) &&
        !element.innerText.replace(/\n/g, "") &&
        countSiblings(content, spot) > 1
      ) {
        event.preventDefault();
        patch((draft) => removeSpot(draft, spot));
        focusAfterWrite(siblingSpot(spot, Math.max(0, spotIndex(spot) - 1)));
        element.blur();
      }
    };

    // Focus from the keyboard: the browser puts the caret right after it
    const handleFocusIn = (event: FocusEvent) => {
      const element = closest(event.target, "[data-edit]");
      if (!element?.textContent?.includes(PLACEHOLDER_MARK)) return;
      window.clearTimeout(selectTimer);
      selectTimer = window.setTimeout(() => selectTodo(element), 0);
    };

    // Pressing or scrolling the canvas closes what was open over it
    const closePopover = () => {
      if (latest.current.popover) setPopover(null);
    };

    const handlePointerDown = (event: PointerEvent) => {
      closePopover();
      const handle = closest(event.target, '[data-action="section-drag"]');
      if (!handle) return;
      startSectionDrag({
        doc,
        handle,
        event,
        onDrop: (from, to) =>
          latest.current.patch((draft) => moveItem(draft.sections, from, to)),
      });
    };

    const preventDefault = (event: Event) => event.preventDefault();

    doc.addEventListener("click", handleClick);
    doc.addEventListener("input", handleInput);
    doc.addEventListener("keydown", handleKeyDown);
    doc.addEventListener("focusin", handleFocusIn);
    doc.addEventListener("pointerdown", handlePointerDown);
    doc.addEventListener("submit", preventDefault);
    doc.addEventListener("dragstart", preventDefault);
    view?.addEventListener("wheel", closePopover, { passive: true });
    view?.addEventListener("touchmove", closePopover, { passive: true });
    return () => {
      window.clearTimeout(selectTimer);
      doc.removeEventListener("click", handleClick);
      doc.removeEventListener("input", handleInput);
      doc.removeEventListener("keydown", handleKeyDown);
      doc.removeEventListener("focusin", handleFocusIn);
      doc.removeEventListener("pointerdown", handlePointerDown);
      doc.removeEventListener("submit", preventDefault);
      doc.removeEventListener("dragstart", preventDefault);
      view?.removeEventListener("wheel", closePopover);
      view?.removeEventListener("touchmove", closePopover);
    };
  }, [doc, focusAfterWrite, scrollTo, notify]);

  // The blob page inherits this origin (the CRM's), so its script runs in
  // preview mode: no request and no localStorage or sessionStorage access.
  const openInNewTab = () => {
    const page = renderLandingPage(content, {
      slug,
      submitUrl: "",
      preview: true,
      productos,
    });
    const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const width = DEVICE_WIDTHS[device];
  const scale = pane.width ? Math.min(1, pane.width / width) : 1;
  const t = (key: string) => translate(`${EDITOR}.${key}`);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">{toolbar}</div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border p-0.5">
            {(["desktop", "mobile"] as const).map((option) => {
              const Icon = option === "desktop" ? Monitor : Smartphone;
              return (
                <Button
                  key={option}
                  type="button"
                  size="icon"
                  className="size-7"
                  variant={device === option ? "secondary" : "ghost"}
                  aria-pressed={device === option}
                  aria-label={t(option)}
                  title={t(option)}
                  onClick={() => setDevice(option)}
                >
                  <Icon className="size-4" />
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={openInNewTab}
          >
            <ExternalLink />
            {t("open_preview")}
          </Button>
        </div>
      </div>
      <div
        ref={paneRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted"
      >
        {/* Out of the flow: its 1280px cannot widen the page around the pane */}
        <div
          // Measured at runtime: the page width, scaled to fit the pane
          style={
            {
              "--canvas-width": `${width * scale}px`,
              "--frame-width": `${width}px`,
              "--frame-height": `${scale ? pane.height / scale : pane.height}px`,
              "--frame-scale": scale,
            } as CSSProperties
          }
          className={cn(
            "absolute inset-y-0 w-(--canvas-width) overflow-hidden",
            device === "mobile" ? "left-1/2 -translate-x-1/2" : "left-0",
          )}
        >
          <iframe
            ref={frameRef}
            title={t("canvas.title")}
            // No allow-scripts: nothing of the page runs. Same origin only lets
            // the editor write into the frame and listen to it.
            sandbox="allow-same-origin"
            srcDoc={EMPTY_PAGE}
            onLoad={() => setDoc(frameRef.current?.contentDocument ?? null)}
            className="h-(--frame-height) w-(--frame-width) origin-top-left scale-(--frame-scale) bg-white"
          />
        </div>
      </div>
      {popover && (
        <LandingCanvasPopover
          key={popover.anchor}
          frameRef={frameRef}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        >
          {popover.kind === "image" && (
            <ImagePicker
              label={t(
                popover.path === "hero.logoUrl" ? "page.logo" : "page.image",
              )}
              value={readText(content, popover.path)}
              readOnly={readOnly}
              onChange={(value) =>
                patch((draft) => writeText(draft, popover.path, value))
              }
            />
          )}
          {popover.kind === "video" && (
            <VideoPicker
              value={readText(content, popover.path)}
              onChange={(value) =>
                patch((draft) => writeText(draft, popover.path, value), {
                  mergeKey: popover.path,
                })
              }
            />
          )}
          {popover.kind === "field" && content.form.fields[popover.index] && (
            <FieldSettings
              field={content.form.fields[popover.index]}
              index={popover.index}
              patch={patch}
              onRemove={() => {
                patch((draft) => {
                  draft.form.fields.splice(popover.index, 1);
                });
                setPopover(null);
              }}
            />
          )}
          {popover.kind === "add-section" && (
            <SectionPicker onPick={(type) => addSection(type, popover.at)} />
          )}
          {popover.kind === "add-field" && (
            <QuestionPicker fields={content.form.fields} onPick={addField} />
          )}
        </LandingCanvasPopover>
      )}
    </div>
  );
};
