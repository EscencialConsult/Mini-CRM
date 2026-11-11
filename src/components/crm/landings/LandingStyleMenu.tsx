import { Palette } from "lucide-react";
import { useTranslate } from "ra-core";
import { type CSSProperties, useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  LANDING_FONTS,
  type LandingContent,
  type LandingFont,
} from "./pagina/schema.ts";
import {
  ColorField,
  EditorSection,
  ImageField,
  type PatchLanding,
  PickField,
  Segmented,
} from "./landingControls";

/** A starting point that already reads well; every color can still be changed. */
const LANDING_PALETTES = [
  { id: "teal", primary: "#0f766e", color: "#0f766e", color2: "#134e4a" },
  { id: "blue", primary: "#1d4ed8", color: "#1e40af", color2: "#172554" },
  { id: "indigo", primary: "#4338ca", color: "#312e81", color2: "#1e1b4b" },
  { id: "wine", primary: "#9f1239", color: "#9f1239", color2: "#4c0519" },
  { id: "forest", primary: "#15803d", color: "#166534", color2: "#052e16" },
  { id: "amber", primary: "#b45309", color: "#92400e", color2: "#451a03" },
  { id: "graphite", primary: "#0f172a", color: "#1e293b", color2: "#020617" },
  { id: "light", primary: "#0f766e", color: "#f0fdfa", color2: "#ccfbf1" },
];

interface StyleProps {
  content: LandingContent;
  patch: PatchLanding;
  readOnly?: boolean;
}

/** The look of the whole page: colors, background of the hero and type. */
export const LandingStyleMenu = (props: StyleProps) => {
  const translate = useTranslate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Palette />
          {translate("resources.landings.editor.canvas.style")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="max-h-(--radix-popover-content-available-height) w-[22rem] overflow-y-auto"
      >
        <StylePanel {...props} />
      </PopoverContent>
    </Popover>
  );
};

const StylePanel = ({ content, patch, readOnly }: StyleProps) => {
  const translate = useTranslate();
  const t = (key: string) =>
    translate(`resources.landings.editor.design.${key}`);
  const { design } = content;
  const { background } = design;
  const overlayId = useId();

  return (
    <div className="space-y-6">
      <EditorSection title={t("palette")} help={t("palette_help")}>
        <div className="grid grid-cols-4 gap-2">
          {LANDING_PALETTES.map((palette) => {
            const isActive =
              design.primaryColor === palette.primary &&
              background.color === palette.color &&
              background.color2 === palette.color2;
            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={isActive}
                aria-label={t(`palettes.${palette.id}`)}
                title={t(`palettes.${palette.id}`)}
                className={cn(
                  "h-12 rounded-md border-2 bg-linear-135 from-(--palette-from) to-(--palette-to)",
                  isActive ? "border-foreground" : "border-transparent",
                )}
                style={
                  {
                    "--palette-from": palette.color,
                    "--palette-to": palette.color2,
                  } as CSSProperties
                }
                onClick={() =>
                  patch((draft) => {
                    draft.design.primaryColor = palette.primary;
                    draft.design.background.color = palette.color;
                    draft.design.background.color2 = palette.color2;
                    if (draft.design.background.type === "image") return;
                    draft.design.background.type = "gradient";
                  })
                }
              />
            );
          })}
        </div>
        <ColorField
          label={t("primary")}
          value={design.primaryColor}
          onChange={(value) =>
            patch(
              (draft) => {
                draft.design.primaryColor = value;
              },
              { mergeKey: "design.primaryColor" },
            )
          }
        />
      </EditorSection>

      <EditorSection title={t("background")}>
        <Segmented
          label={t("background_type")}
          value={background.type}
          options={[
            { value: "gradient", label: t("background_gradient") },
            { value: "color", label: t("background_color") },
            { value: "image", label: t("background_image") },
          ]}
          onChange={(type) =>
            patch((draft) => {
              draft.design.background.type = type;
            })
          }
        />
        {background.type !== "image" && (
          <ColorField
            label={t("color")}
            value={background.color}
            onChange={(value) =>
              patch(
                (draft) => {
                  draft.design.background.color = value;
                },
                { mergeKey: "design.background.color" },
              )
            }
          />
        )}
        {background.type === "gradient" && (
          <ColorField
            label={t("color2")}
            value={background.color2}
            onChange={(value) =>
              patch(
                (draft) => {
                  draft.design.background.color2 = value;
                },
                { mergeKey: "design.background.color2" },
              )
            }
          />
        )}
        {background.type === "image" && (
          <>
            <ImageField
              label={t("image")}
              value={background.imageUrl}
              readOnly={readOnly}
              onChange={(value) =>
                patch((draft) => {
                  draft.design.background.imageUrl = value;
                })
              }
            />
            <div className="space-y-1.5">
              <Label htmlFor={overlayId}>
                {t("overlay")}: {background.overlay}%
              </Label>
              <input
                id={overlayId}
                type="range"
                min={0}
                max={80}
                step={5}
                value={background.overlay}
                className="w-full"
                onChange={(event) =>
                  patch(
                    (draft) => {
                      draft.design.background.overlay = Number(
                        event.target.value,
                      );
                    },
                    { mergeKey: "design.background.overlay" },
                  )
                }
              />
            </div>
          </>
        )}
      </EditorSection>

      <PickField
        label={t("font")}
        value={design.font}
        choices={(Object.keys(LANDING_FONTS) as LandingFont[]).map((font) => ({
          value: font,
          label: t(`fonts.${font}`),
        }))}
        onChange={(font) =>
          patch((draft) => {
            draft.design.font = font as LandingFont;
          })
        }
      />
    </div>
  );
};
