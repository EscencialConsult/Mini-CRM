import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useNotify, useTranslate } from "ra-core";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  isFacebookPixelId,
  isGoogleTagId,
  isHttpUrl,
  isValidSlug,
  type LandingContent,
  type LandingProblem,
  phoneDigits,
  toSlug,
} from "./pagina/schema.ts";
import type { Landing } from "../domain/types";
import {
  findPlaceholderSpots,
  type LandingEditorTarget,
  type PlaceholderSpot,
  problemTarget,
  SETTINGS_ANCHORS,
  spotTarget,
} from "./landingChecklist";
import {
  EditorSection,
  ImageField,
  type PatchLanding,
  PickField,
  SwitchField,
  TextField,
} from "./landingControls";
import { LandingCarritoSettings } from "./LandingCarritoSettings";
import { LandingFollowUpTab } from "./LandingFollowUpTab";
import { LANDINGS_HOST, landingUrl } from "./landingUrls";

const EDITOR = "resources.landings.editor";

const CAMPAIGN_SOURCES = [
  { id: "facebook", source: "facebook", medium: "paid_social" },
  { id: "instagram", source: "instagram", medium: "paid_social" },
  { id: "google", source: "google", medium: "cpc" },
  { id: "email", source: "email", medium: "email" },
  { id: "whatsapp", source: "whatsapp", medium: "social" },
];

/** A card that groups related settings under one heading. */
const SettingsGroup = ({
  id,
  title,
  help,
  children,
}: {
  id: string;
  title: string;
  help?: string;
  children: ReactNode;
}) => (
  <section
    id={id}
    className="scroll-mt-24 space-y-6 rounded-xl border bg-card p-4 sm:p-5"
  >
    <div className="space-y-0.5">
      <h2 className="text-base font-semibold">{title}</h2>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
    </div>
    {children}
  </section>
);

/** The groups of the tab, in order, so the index can take you to each one. */
const SETTINGS_GROUPS = [
  { anchor: SETTINGS_ANCHORS.groupPublication, key: "publication" },
  { anchor: SETTINGS_ANCHORS.groupForm, key: "form" },
  { anchor: SETTINGS_ANCHORS.groupCart, key: "cart" },
  { anchor: SETTINGS_ANCHORS.groupFollowUp, key: "follow_up" },
  { anchor: SETTINGS_ANCHORS.groupCampaigns, key: "campaigns" },
] as const;

/** A short list of the groups: the tab is long, and this saves scrolling. */
const SettingsIndex = () => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.settings.${key}`);
  return (
    <nav
      aria-label={t("index")}
      className="sticky top-0 z-10 rounded-xl border bg-card/95 p-2 backdrop-blur"
    >
      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
        {t("index")}
      </p>
      <ul className="flex flex-wrap gap-1">
        {SETTINGS_GROUPS.map((group) => (
          <li key={group.key}>
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent active:bg-accent/80"
              onClick={() =>
                document
                  .getElementById(group.anchor)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {t(`groups.${group.key}`)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const translate = useTranslate();
  const notify = useNotify();
  return (
    <Button
      type="button"
      variant="outline"
      className="shrink-0"
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() =>
            notify("resources.landings.list.link_copied", {
              type: "info",
            }),
          )
          .catch(() => notify("crm.common.copy_error", { type: "error" }))
      }
    >
      <Copy />
      {translate(label)}
    </Button>
  );
};

/** One link per ad or post, so Results can tell which one brought each lead. */
const CampaignLinks = ({ slug }: { slug: string }) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.campaigns.${key}`);
  const outputId = useId();
  const [sourceId, setSourceId] = useState(CAMPAIGN_SOURCES[0].id);
  const [campaign, setCampaign] = useState("");
  const [variant, setVariant] = useState("");
  const source =
    CAMPAIGN_SOURCES.find((item) => item.id === sourceId) ??
    CAMPAIGN_SOURCES[0];
  const params = new URLSearchParams({
    utm_source: source.source,
    utm_medium: source.medium,
    ...(campaign.trim() ? { utm_campaign: toSlug(campaign) } : {}),
    ...(variant.trim() ? { utm_content: toSlug(variant) } : {}),
  });
  const link = `${landingUrl(slug)}/?${params}`;
  return (
    <EditorSection title={t("title")} help={t("help")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <PickField
          label={t("source")}
          value={sourceId}
          choices={CAMPAIGN_SOURCES.map((item) => ({
            value: item.id,
            label: t(`sources.${item.id}`),
          }))}
          onChange={setSourceId}
        />
        <TextField
          label={t("campaign")}
          placeholder={t("campaign_placeholder")}
          value={campaign}
          onChange={setCampaign}
        />
      </div>
      <TextField
        label={t("variant")}
        hint={t("variant_hint")}
        value={variant}
        onChange={setVariant}
      />
      <div className="space-y-1.5">
        <Label htmlFor={outputId}>{t("link")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={outputId}
            readOnly
            value={link}
            className="min-w-0 font-mono text-xs"
            onFocus={(event) => event.target.select()}
          />
          <CopyButton text={link} label="resources.landings.list.copy_link" />
        </div>
      </div>
    </EditorSection>
  );
};

const Checklist = ({
  content,
  problems,
  onGoTo,
}: {
  content: LandingContent;
  problems: (LandingProblem | "slug_invalid")[];
  onGoTo: (target: LandingEditorTarget) => void;
}) => {
  const translate = useTranslate();
  const t = (key: string, options?: object) =>
    translate(`${EDITOR}.checklist.${key}`, options);
  if (!problems.length) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{t("ready")}</span>
      </div>
    );
  }
  const spotName = (spot: PlaceholderSpot) =>
    spot.key === "section"
      ? translate(`${EDITOR}.sections.types.${spot.sectionType}.name`)
      : t(`spots.${spot.key}`);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/40">
      <h3 className="mb-2 text-sm font-semibold">
        {t("pending", { smart_count: problems.length })}
      </h3>
      <ul className="space-y-1">
        {problems.map((problem) => (
          <li key={problem}>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-md p-1 text-left text-sm transition-colors hover:bg-accent/60 active:bg-accent"
              onClick={() => onGoTo(problemTarget(problem, content))}
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span className="min-w-0 flex-1">
                {translate(`resources.landings.problems.${problem}`)}
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </button>
            {problem === "placeholder_left" && (
              <ul className="mt-0.5 ml-7 flex flex-wrap gap-1">
                {findPlaceholderSpots(content).map((spot) => (
                  <li key={spot.sectionId ?? spot.key}>
                    <button
                      type="button"
                      className="rounded-full border bg-background px-2 py-0.5 text-xs transition-colors hover:bg-accent active:bg-accent/80"
                      onClick={() => onGoTo(spotTarget(spot))}
                    >
                      {spotName(spot)} ({spot.count})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** What happens after sending, the WhatsApp button and the consent. */
const FormSettings = ({
  content,
  patch,
}: {
  content: LandingContent;
  patch: PatchLanding;
}) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.questionnaire.${key}`);
  const { form, thanks, whatsapp } = content;
  const type = (key: string, recipe: (draft: LandingContent) => void) =>
    patch(recipe, { mergeKey: key });
  const needsPhone = whatsapp.enabled || thanks.mode === "whatsapp";

  return (
    <>
      <div id={SETTINGS_ANCHORS.afterSend} className="scroll-mt-24">
        <EditorSection title={t("after_send")} help={t("after_send_help")}>
          <PickField
            label={t("after_send_mode")}
            value={thanks.mode}
            choices={[
              { value: "message", label: t("mode_message") },
              { value: "whatsapp", label: t("mode_whatsapp") },
              { value: "url", label: t("mode_url") },
            ]}
            onChange={(value) =>
              patch((draft) => {
                draft.thanks.mode = value as typeof thanks.mode;
              })
            }
          />
          {thanks.mode === "message" && (
            <>
              <TextField
                label={t("thanks_title")}
                value={thanks.title}
                onChange={(value) =>
                  type("thanks.title", (draft) => {
                    draft.thanks.title = value;
                  })
                }
              />
              <TextField
                label={t("thanks_message")}
                value={thanks.message}
                multiline
                rows={2}
                onChange={(value) =>
                  type("thanks.message", (draft) => {
                    draft.thanks.message = value;
                  })
                }
              />
            </>
          )}
          {thanks.mode === "url" && (
            <TextField
              label={t("thanks_url")}
              value={thanks.url}
              placeholder="https://"
              error={
                thanks.url.trim() && !isHttpUrl(thanks.url.trim())
                  ? t("thanks_url_invalid")
                  : undefined
              }
              onChange={(value) =>
                type("thanks.url", (draft) => {
                  draft.thanks.url = value;
                })
              }
            />
          )}
        </EditorSection>
      </div>

      <div id={SETTINGS_ANCHORS.whatsapp} className="scroll-mt-24">
        <EditorSection title={t("whatsapp")} help={t("whatsapp_help")}>
          <SwitchField
            label={t("whatsapp_enabled")}
            checked={whatsapp.enabled}
            onChange={(enabled) =>
              patch((draft) => {
                draft.whatsapp.enabled = enabled;
              })
            }
          />
          {needsPhone && (
            <>
              <TextField
                label={t("whatsapp_phone")}
                hint={t("whatsapp_phone_hint")}
                error={
                  phoneDigits(whatsapp.phone)
                    ? undefined
                    : t("whatsapp_phone_missing")
                }
                value={whatsapp.phone}
                onChange={(value) =>
                  type("whatsapp.phone", (draft) => {
                    draft.whatsapp.phone = value;
                  })
                }
              />
              <TextField
                label={t("whatsapp_message")}
                hint={t("whatsapp_message_hint")}
                value={whatsapp.message}
                onChange={(value) =>
                  type("whatsapp.message", (draft) => {
                    draft.whatsapp.message = value;
                  })
                }
              />
            </>
          )}
          {whatsapp.enabled && (
            <>
              <TextField
                label={t("whatsapp_popup_title")}
                value={whatsapp.popupTitle}
                onChange={(value) =>
                  type("whatsapp.popupTitle", (draft) => {
                    draft.whatsapp.popupTitle = value;
                  })
                }
              />
              <TextField
                label={t("whatsapp_popup_text")}
                value={whatsapp.popupText}
                onChange={(value) =>
                  type("whatsapp.popupText", (draft) => {
                    draft.whatsapp.popupText = value;
                  })
                }
              />
            </>
          )}
        </EditorSection>
      </div>

      <div id={SETTINGS_ANCHORS.consent} className="scroll-mt-24">
        <EditorSection title={t("consent")} help={t("consent_help")}>
          <SwitchField
            label={t("consent_enabled")}
            checked={form.consent.enabled}
            onChange={(enabled) =>
              patch((draft) => {
                draft.form.consent.enabled = enabled;
              })
            }
          />
          {form.consent.enabled && (
            <TextField
              label={t("consent_text")}
              value={form.consent.text}
              multiline
              rows={2}
              onChange={(value) =>
                type("form.consent.text", (draft) => {
                  draft.form.consent.text = value;
                })
              }
            />
          )}
        </EditorSection>
      </div>
    </>
  );
};

/** Everything a visitor does not see on the page: address, form, follow-up. */
export const LandingSettingsTab = ({
  content,
  patch,
  readOnly,
  name,
  onNameChange,
  slug,
  onSlugChange,
  landing,
  problems,
  onGoTo,
}: {
  content: LandingContent;
  patch: PatchLanding;
  readOnly?: boolean;
  name: string;
  onNameChange: (name: string) => void;
  slug: string;
  onSlugChange: (slug: string) => void;
  landing?: Landing;
  problems: (LandingProblem | "slug_invalid")[];
  onGoTo: (target: LandingEditorTarget) => void;
}) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.settings.${key}`);
  const { seo, privacy, tracking } = content;
  // A published landing keeps its address: ads may already point there
  const isLocked = landing?.estado === "publicada";
  const type = (key: string, recipe: (draft: LandingContent) => void) =>
    patch(recipe, { mergeKey: key });

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <SettingsIndex />
      <SettingsGroup
        id={SETTINGS_ANCHORS.groupPublication}
        title={t("groups.publication")}
        help={t("groups_help.publication")}
      >
        <div id={SETTINGS_ANCHORS.checklist} className="scroll-mt-24">
          <Checklist content={content} problems={problems} onGoTo={onGoTo} />
        </div>
        <div id={SETTINGS_ANCHORS.general} className="scroll-mt-24">
          <EditorSection title={t("general")}>
            <TextField
              label={t("name")}
              hint={t("name_hint")}
              value={name}
              error={name.trim() ? undefined : t("name_missing")}
              onChange={onNameChange}
            />
            <TextField
              label={t("slug")}
              value={slug}
              disabled={isLocked}
              prefix={`${LANDINGS_HOST}/`}
              hint={t(isLocked ? "slug_locked" : "slug_hint")}
              error={
                isLocked || isValidSlug(slug) ? undefined : t("slug_invalid")
              }
              onChange={(value) => onSlugChange(value.toLowerCase())}
            />
            {isLocked && (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a
                    href={landingUrl(slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {translate("resources.landings.list.open")}
                  </a>
                </Button>
                <CopyButton
                  text={landingUrl(slug)}
                  label="resources.landings.list.copy_link"
                />
              </div>
            )}
          </EditorSection>
        </div>
        <div id={SETTINGS_ANCHORS.sharing} className="scroll-mt-24">
          <EditorSection title={t("sharing")} help={t("sharing_help")}>
            <TextField
              label={t("seo_title")}
              value={seo.title}
              onChange={(value) =>
                type("seo.title", (draft) => {
                  draft.seo.title = value;
                })
              }
            />
            <TextField
              label={t("seo_description")}
              value={seo.description}
              multiline
              rows={2}
              onChange={(value) =>
                type("seo.description", (draft) => {
                  draft.seo.description = value;
                })
              }
            />
            <ImageField
              label={t("seo_image")}
              value={seo.imageUrl}
              readOnly={readOnly}
              onChange={(value) =>
                patch((draft) => {
                  draft.seo.imageUrl = value;
                })
              }
            />
          </EditorSection>
        </div>
        <div id={SETTINGS_ANCHORS.privacy} className="scroll-mt-24">
          <EditorSection title={t("privacy")} help={t("privacy_help")}>
            <TextField
              label={t("privacy_title")}
              value={privacy.title}
              onChange={(value) =>
                type("privacy.title", (draft) => {
                  draft.privacy.title = value;
                })
              }
            />
            <TextField
              label={t("privacy_text")}
              value={privacy.text}
              multiline
              rows={8}
              onChange={(value) =>
                type("privacy.text", (draft) => {
                  draft.privacy.text = value;
                })
              }
            />
          </EditorSection>
        </div>
      </SettingsGroup>

      <SettingsGroup
        id={SETTINGS_ANCHORS.groupForm}
        title={t("groups.form")}
        help={t("groups_help.form")}
      >
        <FormSettings content={content} patch={patch} />
      </SettingsGroup>

      <SettingsGroup
        id={SETTINGS_ANCHORS.groupCart}
        title={t("groups.cart")}
        help={t("groups_help.cart")}
      >
        <LandingCarritoSettings
          content={content}
          patch={patch}
          landing={landing}
        />
      </SettingsGroup>

      <SettingsGroup
        id={SETTINGS_ANCHORS.groupFollowUp}
        title={t("groups.follow_up")}
        help={t("groups_help.follow_up")}
      >
        <LandingFollowUpTab content={content} patch={patch} />
      </SettingsGroup>

      <SettingsGroup
        id={SETTINGS_ANCHORS.groupCampaigns}
        title={t("groups.campaigns")}
        help={t("groups_help.campaigns")}
      >
        <CampaignLinks slug={slug} />
        <div id={SETTINGS_ANCHORS.tracking} className="scroll-mt-24">
          <EditorSection title={t("tracking")} help={t("tracking_help")}>
            <TextField
              label={t("facebook_pixel")}
              placeholder="123456789012345"
              value={tracking.facebookPixelId}
              error={
                tracking.facebookPixelId &&
                !isFacebookPixelId(tracking.facebookPixelId.trim())
                  ? t("facebook_pixel_invalid")
                  : undefined
              }
              onChange={(value) =>
                type("tracking.facebookPixelId", (draft) => {
                  draft.tracking.facebookPixelId = value.trim();
                })
              }
            />
            <TextField
              label={t("google_tag")}
              placeholder="G-XXXXXXXXXX"
              value={tracking.googleTagId}
              error={
                tracking.googleTagId &&
                !isGoogleTagId(tracking.googleTagId.trim())
                  ? t("google_tag_invalid")
                  : undefined
              }
              onChange={(value) =>
                type("tracking.googleTagId", (draft) => {
                  draft.tracking.googleTagId = value.trim().toUpperCase();
                })
              }
            />
          </EditorSection>
        </div>
      </SettingsGroup>
    </div>
  );
};
