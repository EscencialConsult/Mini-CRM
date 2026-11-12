import {
  type LandingContent,
  type LandingProblem,
  PLACEHOLDER_MARK,
  videoEmbedUrl,
} from "./pagina/schema.ts";

export type LandingEditorTab = "design" | "settings" | "results";

/** A place of the editor: a part of the page, or a group of the settings. */
export interface LandingEditorTarget {
  tab: Exclude<LandingEditorTab, "results">;
  anchor: string;
}

/** The ids of the settings groups, so the checklist can take you to each one. */
export const SETTINGS_ANCHORS = {
  checklist: "landing-settings-checklist",
  general: "landing-settings-general",
  afterSend: "landing-settings-after-send",
  whatsapp: "landing-settings-whatsapp",
  consent: "landing-settings-consent",
  cart: "landing-settings-cart",
  tracking: "landing-settings-tracking",
  sharing: "landing-settings-sharing",
  privacy: "landing-settings-privacy",
  groupPublication: "landing-group-publication",
  groupForm: "landing-group-form",
  groupCart: "landing-group-cart",
  groupFollowUp: "landing-group-follow-up",
  groupCampaigns: "landing-group-campaigns",
} as const;

const onPage = (anchor: string): LandingEditorTarget => ({
  tab: "design",
  anchor,
});
const inSettings = (
  anchor: keyof typeof SETTINGS_ANCHORS,
): LandingEditorTarget => ({
  tab: "settings",
  anchor: SETTINGS_ANCHORS[anchor],
});

/** The form's card, wherever the design puts it. */
const FORM_ANCHOR = "formulario";

const firstBadVideo = (content: LandingContent) =>
  content.sections.find(
    (section) =>
      section.enabled &&
      section.type === "video" &&
      section.videoUrl.trim() &&
      !videoEmbedUrl(section.videoUrl),
  );

/** Where each problem gets fixed: the checklist takes you there. */
export const problemTarget = (
  problem: LandingProblem | "slug_invalid",
  content: LandingContent,
): LandingEditorTarget => {
  switch (problem) {
    case "title_missing":
      return onPage("s-hero");
    case "placeholder_left": {
      const [spot] = findPlaceholderSpots(content);
      return spot ? spotTarget(spot) : onPage("s-hero");
    }
    case "name_missing":
    case "contact_missing":
    case "label_missing":
    case "options_missing":
    case "target_repeated":
      return onPage(FORM_ANCHOR);
    case "video_invalid": {
      const section = firstBadVideo(content);
      return onPage(section ? `s-${section.id}` : "s-hero");
    }
    case "consent_missing":
      return inSettings("consent");
    case "privacy_missing":
      return inSettings("privacy");
    case "thanks_url_invalid":
    case "thanks_whatsapp_missing":
      return inSettings("afterSend");
    case "whatsapp_missing":
      return inSettings("whatsapp");
    case "cart_phone_missing":
      return inSettings("cart");
    case "tracking_invalid":
      return inSettings("tracking");
    case "slug_invalid":
      return inSettings("general");
  }
};

/** How many texts are left to complete in this piece of content. */
const countPlaceholders = (value: unknown) =>
  JSON.stringify(value).split(PLACEHOLDER_MARK).length - 1;

export type PlaceholderSpot = {
  /** The part of the page, or the settings group, where this text lives */
  key: "hero" | "footer" | "form" | "seo" | "privacy" | "section";
  sectionId?: string;
  sectionType?: string;
  count: number;
};

/** The texts a visitor would still read as [COMPLETAR], and where they are. */
export const findPlaceholderSpots = (
  content: LandingContent,
): PlaceholderSpot[] => {
  const pieces: PlaceholderSpot[] = [
    { key: "hero", count: countPlaceholders(content.hero) },
    ...content.sections
      .filter((section) => section.enabled)
      .map((section) => ({
        key: "section" as const,
        sectionId: section.id,
        sectionType: section.type,
        count: countPlaceholders(section),
      })),
    { key: "footer", count: countPlaceholders(content.footer) },
    {
      key: "form",
      count: countPlaceholders([
        content.form,
        content.thanks,
        content.whatsapp,
      ]),
    },
    { key: "seo", count: countPlaceholders(content.seo) },
    { key: "privacy", count: countPlaceholders(content.privacy) },
  ];
  return pieces.filter((piece) => piece.count > 0);
};

export const spotTarget = (spot: PlaceholderSpot): LandingEditorTarget => {
  switch (spot.key) {
    case "section":
      return onPage(`s-${spot.sectionId}`);
    case "form":
      return onPage(FORM_ANCHOR);
    case "footer":
      return onPage("s-footer");
    case "seo":
      return inSettings("sharing");
    case "privacy":
      return inSettings("privacy");
    case "hero":
      return onPage("s-hero");
  }
};
