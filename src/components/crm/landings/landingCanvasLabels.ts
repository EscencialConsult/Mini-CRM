import type { TranslateFunction } from "ra-core";

import type { LandingContent } from "./pagina/schema.ts";
import type { CanvasChromeContext } from "./landingCanvasChrome";
import { readText } from "./landingCanvasPaths";
import { LANDING_SECTION_SHAPES } from "./landingSections";

const EDITOR = "resources.landings.editor";

/** Lists that read better one under another than as cards side by side. */
const STACKED_TYPES = new Set(["modules", "faq"]);

const ITEM_PATH = /^sections\.(\d+)\.items\.\d+\.(title|subtitle|text)$/;
const SECTION_PATH =
  /^sections\.(\d+)\.(title|text|ctaLabel|imageUrl|videoUrl)$/;

const FIXED_KEYS: Record<string, string> = {
  "hero.eyebrow": "page.eyebrow",
  "hero.title": "page.title",
  "hero.subtitle": "page.subtitle",
  "hero.ctaLabel": "page.cta",
  "hero.logoUrl": "canvas.add_logo",
  "hero.imageUrl": "canvas.add_image",
  "footer.company": "page.company",
  "footer.email": "page.email",
  "footer.phone": "page.phone",
  "footer.address": "page.address",
  "form.title": "questionnaire.form_title",
  "form.intro": "questionnaire.intro",
  "form.submitLabel": "questionnaire.submit_label",
  "form.consent.text": "questionnaire.consent_text",
  "whatsapp.label": "questionnaire.whatsapp_label",
};

const SECTION_KEYS: Record<string, string> = {
  title: "sections.title",
  text: "sections.text",
  ctaLabel: "sections.cta",
  imageUrl: "canvas.add_image",
};

/** What an empty text or spot of the canvas says, so it can be found and filled. */
const placeholderFor = (
  path: string,
  content: LandingContent,
  translate: TranslateFunction,
) => {
  const t = (key: string, options?: object) =>
    translate(`${EDITOR}.${key}`, options);
  if (FIXED_KEYS[path]) return t(FIXED_KEYS[path]);
  if (path.startsWith("hero.highlights.")) return t("canvas.highlight");
  if (/^form\.fields\.\d+\.label$/.test(path)) return t("questionnaire.label");

  const item = path.match(ITEM_PATH);
  if (item) {
    const type = content.sections[Number(item[1])]?.type;
    return t(`sections.types.${type}.item_${item[2]}`, {
      _: t(`sections.${item[2] === "subtitle" ? "title" : item[2]}`),
    });
  }
  const section = path.match(SECTION_PATH);
  if (section?.[2] === "videoUrl") {
    const url = readText(content, path).trim();
    return url ? t("canvas.change_video", { url }) : t("canvas.add_video");
  }
  if (section) return t(SECTION_KEYS[section[2]]);
  return "";
};

export const buildCanvasContext = (
  content: LandingContent,
  translate: TranslateFunction,
): CanvasChromeContext => {
  const typeOf = (index: number) => content.sections[index]?.type;
  return {
    label: (key) => translate(`${EDITOR}.canvas.${key}`),
    placeholder: (path) => placeholderFor(path, content, translate),
    sectionName: (index) =>
      translate(`${EDITOR}.sections.types.${typeOf(index)}.name`),
    addItemLabel: (index) => {
      const type = typeOf(index);
      return type && LANDING_SECTION_SHAPES[type].item
        ? translate(`${EDITOR}.sections.types.${type}.add`)
        : "";
    },
    itemsInRow: (index) => !STACKED_TYPES.has(typeOf(index) ?? ""),
    sectionCount: content.sections.length,
    itemCount: (index) => content.sections[index]?.items.length ?? 0,
    fieldCount: content.form.fields.length,
  };
};
