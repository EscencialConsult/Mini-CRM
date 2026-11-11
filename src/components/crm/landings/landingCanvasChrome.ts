import { PLACEHOLDER_MARK } from "./pagina/schema.ts";

/**
 * What the editor adds on top of the page inside the canvas: the look of what
 * can be edited, and the toolbars of sections, items and questions. Plain DOM,
 * written after every render; none of it reaches the published page.
 */
export const CANVAS_STYLES = `
:root{--ed-accent:#2563eb;--ed-ink:#0f172a;--ed-page:#fff;--ed-line:#cbd5e1;--ed-hover:#f1f5f9;--ed-ring:rgba(37,99,235,.35);--ed-shadow:rgba(15,23,42,.28);--ed-badge-bg:#fef3c7;--ed-badge-ink:#92400e;--ed-ui:500 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif}
mark.landing-todo{background:none;color:inherit}
.top{position:relative}
[data-edit]{cursor:text;border-radius:3px;outline:1px dashed transparent;outline-offset:3px;transition:outline-color .12s}
[data-edit]:hover{outline-color:color-mix(in srgb,currentColor 45%,transparent)}
[data-edit]:focus{outline:2px solid var(--ed-accent)}
[data-multi],[data-multi] p{white-space:pre-wrap}
[data-edit]:empty{display:inline-block;min-width:6em}
h1[data-edit]:empty,h2[data-edit]:empty,h3[data-edit]:empty,p[data-edit]:empty,div[data-edit]:empty,blockquote[data-edit]:empty{display:block}
[data-edit]:empty::before{content:attr(data-ph);opacity:.5;pointer-events:none}
[data-image]{cursor:pointer}
img[data-image]:hover{outline:2px solid var(--ed-accent);outline-offset:2px}
.ed-slot{display:flex;align-items:center;justify-content:center;min-height:140px;padding:12px;border:2px dashed currentColor;border-radius:var(--radius);opacity:.6;font-weight:600;font-size:.95rem;text-align:center}
.ed-slot::before{content:attr(data-ph)}
.ed-slot:hover,.ed-slot:focus-visible{opacity:.9;outline:none}
.ed-slot.logo{display:inline-flex;min-height:0;height:34px;margin-right:10px;padding:0 10px;font-size:.78rem;opacity:.45}
.ed-slot.video{aspect-ratio:16/9;min-height:0;background:var(--ed-ink);color:#fff;opacity:1;border-color:rgba(255,255,255,.35)}
[data-section],[data-item],[data-field]{position:relative}
[data-section]:hover{box-shadow:inset 0 0 0 2px var(--ed-ring)}
[data-hidden]>.wrap{opacity:.4}
[data-field]{cursor:pointer;border-radius:6px;outline:1px dashed transparent;outline-offset:4px}
[data-field]:hover{outline-color:var(--ed-line)}
[data-field] input,[data-field] select,[data-field] textarea,.consent input{pointer-events:none}
.ed-bar,.ed-item-bar{position:absolute;z-index:12;display:flex;align-items:center;gap:1px;padding:3px;background:#fff;color:var(--ed-ink);border:1px solid var(--ed-line);border-radius:8px;box-shadow:0 6px 18px rgba(15,23,42,.14);font:var(--ed-ui);opacity:0;transition:opacity .12s}
.ed-bar{top:10px;left:50%;width:max-content;transform:translateX(-50%)}
.ed-item-bar{top:6px;right:6px;padding:2px}
[data-section]:hover>.ed-bar,[data-section]:focus-within>.ed-bar,[data-hidden]>.ed-bar,[data-item]:hover>.ed-item-bar,[data-item]:focus-within>.ed-item-bar,[data-field]:hover>.ed-item-bar,[data-field]:focus-within>.ed-item-bar{opacity:1}
.ed-bar button,.ed-item-bar button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.ed-bar button:hover,.ed-item-bar button:hover{background:var(--ed-hover)}
.ed-bar button:active,.ed-item-bar button:active{transform:scale(.97)}
.ed-bar button:disabled,.ed-item-bar button:disabled{opacity:.35;cursor:default;background:transparent}
.ed-bar button:focus-visible,.ed-item-bar button:focus-visible,.ed-insert button:focus-visible,.ed-add-field button:focus-visible{outline:2px solid var(--ed-accent);outline-offset:1px}
.ed-bar svg,.ed-item-bar svg{width:15px;height:15px}
.ed-bar .ed-handle{cursor:grab;touch-action:none}
.ed-name{padding:0 6px;white-space:nowrap}
.ed-badge{margin-right:2px;padding:4px 6px;border-radius:5px;background:var(--ed-badge-bg);color:var(--ed-badge-ink);white-space:nowrap}
.ed-insert{position:relative;z-index:13;height:0}
.ed-insert::before{content:"";position:absolute;left:0;right:0;top:-14px;height:28px}
.ed-insert button{position:absolute;left:50%;top:0;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border:1px solid var(--ed-accent);border-radius:999px;background:#fff;color:var(--ed-accent);font:var(--ed-ui);font-weight:600;cursor:pointer;opacity:0;transform:translate(-50%,-50%);transition:opacity .12s}
.ed-insert:hover button,.ed-insert button:focus-visible{opacity:1}
.ed-insert button:hover{background:var(--ed-hover)}
.ed-insert.last{display:flex;justify-content:center;height:auto;padding:28px 16px;background:var(--ed-hover)}
.ed-insert.last::before{content:none}
.ed-insert.last button{position:static;opacity:1;transform:none;height:34px;padding:0 16px}
.ed-insert svg,.ed-add-field svg{width:15px;height:15px}
.ed-add-field{margin:-2px 0 16px}
.ed-add-field button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:10px;border:1.5px dashed var(--ed-line);border-radius:max(6px,calc(var(--radius) - 4px));background:transparent;color:var(--muted);font:var(--ed-ui);font-weight:600;cursor:pointer}
.ed-add-field button:hover{border-color:var(--ed-accent);color:var(--ed-accent)}
.ed-drop{position:absolute;left:0;right:0;top:var(--drop-y,0);z-index:30;height:4px;margin-top:-2px;background:var(--ed-accent);pointer-events:none}
.ed-dragging{opacity:.4}
.ed-ghost{position:fixed;left:0;top:0;z-index:29;width:var(--ghost-w);overflow:hidden;background:var(--ed-page);border-radius:calc(10px / var(--ghost-scale));box-shadow:0 calc(14px / var(--ghost-scale)) calc(36px / var(--ghost-scale)) var(--ed-shadow);opacity:.92;pointer-events:none;transform-origin:var(--grab-x) var(--grab-y);transform:translate(var(--ghost-x),var(--ghost-y)) scale(var(--ghost-scale));animation:ed-lift .15s ease-out}
@keyframes ed-lift{from{opacity:0}}
.ed-is-dragging,.ed-is-dragging *{cursor:grabbing!important;user-select:none}
@media (prefers-reduced-motion:reduce){[data-edit],.ed-bar,.ed-item-bar,.ed-insert button{transition:none}.ed-ghost{animation:none}}
`;

const ICONS = {
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  settings:
    '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
} as const;

type IconName = keyof typeof ICONS;

/** What the canvas actions do; the editor handles each one by this name. */
export type CanvasAction =
  | "section-drag"
  | "section-up"
  | "section-down"
  | "section-toggle"
  | "section-duplicate"
  | "section-remove"
  | "section-insert"
  | "item-add"
  | "item-before"
  | "item-after"
  | "item-remove"
  | "field-add"
  | "field-before"
  | "field-after"
  | "field-settings"
  | "field-remove";

export type CanvasLabel =
  | "drag"
  | "move_up"
  | "move_down"
  | "move_before"
  | "move_after"
  | "hide"
  | "show"
  | "hidden"
  | "duplicate"
  | "remove"
  | "add_section"
  | "add_question"
  | "question_settings";

/** The texts and facts of the content the toolbars need. */
export interface CanvasChromeContext {
  label: (key: CanvasLabel) => string;
  placeholder: (path: string) => string;
  sectionName: (index: number) => string;
  /** The "add" text of the items of this section, or "" if it has none */
  addItemLabel: (index: number) => string;
  /** Items side by side (cards) rather than one under another */
  itemsInRow: (index: number) => boolean;
  sectionCount: number;
  itemCount: (index: number) => number;
  fieldCount: number;
}

const createButton = (
  doc: Document,
  {
    action,
    label,
    icon,
    text,
    disabled,
    pressed,
  }: {
    action: CanvasAction;
    label: string;
    icon: IconName;
    text?: string;
    disabled?: boolean;
    pressed?: boolean;
  },
) => {
  const button = doc.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;
  if (text) {
    button.append(text);
  } else {
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  if (disabled) button.disabled = true;
  if (pressed !== undefined)
    button.setAttribute("aria-pressed", String(pressed));
  return button;
};

const createBar = (doc: Document, className: string) => {
  const bar = doc.createElement("div");
  bar.className = className;
  bar.contentEditable = "false";
  return bar;
};

const decorateTexts = (doc: Document, context: CanvasChromeContext) => {
  doc.querySelectorAll<HTMLElement>("[data-edit]").forEach((element) => {
    const placeholder = context.placeholder(element.dataset.edit ?? "");
    element.contentEditable = "plaintext-only";
    element.spellcheck = true;
    element.dataset.ph = placeholder;
    element.setAttribute("role", "textbox");
    element.setAttribute("aria-label", placeholder);
    if (element.dataset.multi !== undefined) {
      element.setAttribute("aria-multiline", "true");
    }
  });
  doc
    .querySelectorAll<HTMLElement>("[data-image],[data-video]")
    .forEach((element) => {
      const path = element.dataset.image ?? element.dataset.video ?? "";
      element.dataset.ph = context.placeholder(path);
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", element.dataset.ph);
      element.tabIndex = 0;
    });
};

const decorateSections = (doc: Document, context: CanvasChromeContext) => {
  const sections = doc.querySelectorAll<HTMLElement>("[data-section]");
  sections.forEach((section) => {
    const index = Number(section.dataset.section);
    const isHidden = section.dataset.hidden !== undefined;
    const bar = createBar(doc, "ed-bar");
    const handle = createButton(doc, {
      action: "section-drag",
      label: context.label("drag"),
      icon: "grip",
    });
    handle.classList.add("ed-handle");
    const name = doc.createElement("span");
    name.className = "ed-name";
    name.textContent = context.sectionName(index);
    bar.append(handle, name);
    if (isHidden) {
      const badge = doc.createElement("span");
      badge.className = "ed-badge";
      badge.textContent = context.label("hidden");
      bar.append(badge);
    }
    const addItem = context.addItemLabel(index);
    if (addItem) {
      bar.append(
        createButton(doc, { action: "item-add", label: addItem, icon: "plus" }),
      );
    }
    bar.append(
      createButton(doc, {
        action: "section-up",
        label: context.label("move_up"),
        icon: "up",
        disabled: index === 0,
      }),
      createButton(doc, {
        action: "section-down",
        label: context.label("move_down"),
        icon: "down",
        disabled: index === context.sectionCount - 1,
      }),
      createButton(doc, {
        action: "section-toggle",
        label: context.label(isHidden ? "show" : "hide"),
        icon: isHidden ? "eyeOff" : "eye",
        pressed: isHidden,
      }),
      createButton(doc, {
        action: "section-duplicate",
        label: context.label("duplicate"),
        icon: "copy",
      }),
      createButton(doc, {
        action: "section-remove",
        label: context.label("remove"),
        icon: "trash",
      }),
    );
    section.prepend(bar);
  });

  // A way to add a section between every two, and a visible one at the end
  const inserter = (at: number, isLast: boolean) => {
    const row = createBar(doc, isLast ? "ed-insert last" : "ed-insert");
    const button = createButton(doc, {
      action: "section-insert",
      label: context.label("add_section"),
      icon: "plus",
      text: context.label("add_section"),
    });
    button.dataset.at = String(at);
    row.append(button);
    return row;
  };
  sections.forEach((section) =>
    section.before(inserter(Number(section.dataset.section), false)),
  );
  const last = sections[sections.length - 1] ?? doc.getElementById("s-hero");
  last?.after(inserter(context.sectionCount, true));
};

const itemBar = (
  doc: Document,
  {
    position,
    total,
    inRow,
    prefix,
    context,
    settings,
  }: {
    position: number;
    total: number;
    inRow: boolean;
    prefix: "item" | "field";
    context: CanvasChromeContext;
    settings?: boolean;
  },
) => {
  const bar = createBar(doc, "ed-item-bar");
  bar.append(
    createButton(doc, {
      action: `${prefix}-before`,
      label: context.label("move_before"),
      icon: inRow ? "left" : "up",
      disabled: position === 0,
    }),
    createButton(doc, {
      action: `${prefix}-after`,
      label: context.label("move_after"),
      icon: inRow ? "right" : "down",
      disabled: position === total - 1,
    }),
  );
  if (settings) {
    bar.append(
      createButton(doc, {
        action: "field-settings",
        label: context.label("question_settings"),
        icon: "settings",
      }),
    );
  }
  bar.append(
    createButton(doc, {
      action: `${prefix}-remove`,
      label: context.label("remove"),
      icon: "trash",
    }),
  );
  return bar;
};

const decorateItems = (doc: Document, context: CanvasChromeContext) => {
  doc.querySelectorAll<HTMLElement>("[data-item]").forEach((item) => {
    const section = Number(
      item.closest<HTMLElement>("[data-section]")?.dataset.section,
    );
    item.append(
      itemBar(doc, {
        position: Number(item.dataset.item),
        total: context.itemCount(section),
        inRow: context.itemsInRow(section),
        prefix: "item",
        context,
      }),
    );
  });
  doc.querySelectorAll<HTMLElement>("[data-field]").forEach((field) => {
    field.append(
      itemBar(doc, {
        position: Number(field.dataset.field),
        total: context.fieldCount,
        inRow: false,
        prefix: "field",
        context,
        settings: true,
      }),
    );
  });
  const fields = doc.querySelector("#lead-form .fields");
  if (fields) {
    const row = createBar(doc, "ed-add-field");
    row.append(
      createButton(doc, {
        action: "field-add",
        label: context.label("add_question"),
        icon: "plus",
        text: context.label("add_question"),
      }),
    );
    fields.after(row);
  }
};

/** Wraps what is left to complete, so focusing its text selects it whole. */
const markPlaceholders = (doc: Document) => {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (
      node.data.includes(PLACEHOLDER_MARK) &&
      node.parentElement?.tagName !== "OPTION"
    ) {
      found.push(node);
    }
  }
  for (const node of found) {
    const mark = doc.createElement("mark");
    mark.className = "landing-todo";
    node.replaceWith(mark);
    mark.append(node);
  }
};

export const decorateCanvas = (doc: Document, context: CanvasChromeContext) => {
  markPlaceholders(doc);
  decorateTexts(doc, context);
  decorateSections(doc, context);
  decorateItems(doc, context);
};
