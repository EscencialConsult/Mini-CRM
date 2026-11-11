import { Trash2 } from "lucide-react";
import { useTranslate } from "ra-core";
import { type ReactNode, type RefObject, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

import {
  CHOICE_FIELD_TYPES,
  LANDING_FIELD_TYPES,
  LANDING_SECTION_TYPES,
  type LandingField,
  type LandingFieldType,
  type LandingSectionType,
  videoEmbedUrl,
} from "./pagina/schema.ts";
import {
  ImageField,
  type PatchLanding,
  PickField,
  SwitchField,
  TextField,
} from "./landingControls";
import {
  availablePresets,
  type PresetQuestion,
  targetForType,
  useFieldTargets,
} from "./landingQuestions";
import { LANDING_SECTION_SHAPES } from "./landingSections";

const EDITOR = "resources.landings.editor";

/** What is open over the canvas; `anchor` finds its element inside the frame. */
export type CanvasPopoverState =
  | { kind: "image"; path: string; anchor: string }
  | { kind: "video"; path: string; anchor: string }
  | { kind: "field"; index: number; anchor: string }
  | { kind: "add-section"; at: number; anchor: string }
  | { kind: "add-field"; anchor: string };

/**
 * Where an element of the canvas is, in the coordinates of the editor: the
 * frame is scaled, and its elements are looked up again after every render.
 */
const useFrameAnchor = (
  frameRef: RefObject<HTMLIFrameElement | null>,
  selector: string,
) => {
  const last = useRef<DOMRect | null>(null);
  return useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          const frame = frameRef.current;
          const element = frame?.contentDocument?.querySelector(selector);
          if (!frame || !element) return last.current ?? new DOMRect();
          const outer = frame.getBoundingClientRect();
          const scale = frame.offsetWidth ? outer.width / frame.offsetWidth : 1;
          const box = element.getBoundingClientRect();
          last.current = new DOMRect(
            outer.left + box.left * scale,
            outer.top + box.top * scale,
            box.width * scale,
            box.height * scale,
          );
          return last.current;
        },
      },
    }),
    [frameRef, selector],
  );
};

export const LandingCanvasPopover = ({
  frameRef,
  anchor,
  onClose,
  children,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  anchor: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const anchorRef = useFrameAnchor(frameRef, anchor);
  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};

const PopoverTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-3 text-sm font-semibold">{children}</h3>
);

export const ImagePicker = ({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) => {
  const translate = useTranslate();
  return (
    <div className="space-y-3">
      <ImageField
        label={label}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onChange("")}
        >
          <Trash2 />
          {translate(`${EDITOR}.canvas.remove_image`)}
        </Button>
      )}
    </div>
  );
};

export const VideoPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.sections.${key}`);
  return (
    <TextField
      label={t("video")}
      value={value}
      placeholder="https://www.youtube.com/watch?v=..."
      hint={t("video_hint")}
      error={
        value.trim() && !videoEmbedUrl(value) ? t("video_invalid") : undefined
      }
      onChange={onChange}
    />
  );
};

export const FieldSettings = ({
  field,
  index,
  patch,
  onRemove,
}: {
  field: LandingField;
  index: number;
  patch: PatchLanding;
  onRemove: () => void;
}) => {
  const translate = useTranslate();
  const targets = useFieldTargets();
  const t = (key: string) => translate(`${EDITOR}.questionnaire.${key}`);
  const change = (recipe: (question: LandingField) => void, key: string) =>
    patch((draft) => recipe(draft.form.fields[index]), {
      mergeKey: `form.fields.${index}.${key}`,
    });

  return (
    <div className="space-y-3">
      <PopoverTitle>
        {translate(`${EDITOR}.canvas.question_settings`)}
      </PopoverTitle>
      <TextField
        label={t("label")}
        value={field.label}
        onChange={(value) =>
          change((question) => {
            question.label = value;
          }, "label")
        }
      />
      <PickField
        label={t("type")}
        value={field.type}
        choices={LANDING_FIELD_TYPES.map((type) => ({
          value: type,
          label: t(`types.${type}`),
        }))}
        onChange={(value) =>
          change((question) => {
            question.type = value as LandingFieldType;
            question.target = targetForType(question.type, question.target);
          }, "type")
        }
      />
      <PickField
        label={t("target")}
        value={field.target}
        choices={targets}
        onChange={(value) =>
          change((question) => {
            question.target = value;
          }, "target")
        }
      />
      {CHOICE_FIELD_TYPES.includes(field.type) && (
        <TextField
          label={t("options")}
          hint={t("options_hint")}
          multiline
          value={field.options.join("\n")}
          onChange={(value) =>
            change((question) => {
              question.options = value.split("\n");
            }, "options")
          }
        />
      )}
      <SwitchField
        label={t("required")}
        checked={field.required}
        onChange={(required) =>
          change((question) => {
            question.required = required;
          }, "required")
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 />
        {translate(`${EDITOR}.canvas.remove_question`)}
      </Button>
    </div>
  );
};

export const SectionPicker = ({
  onPick,
}: {
  onPick: (type: LandingSectionType) => void;
}) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.sections.${key}`);
  return (
    <div>
      <PopoverTitle>{t("add")}</PopoverTitle>
      <ul className="grid grid-cols-1 gap-0.5">
        {LANDING_SECTION_TYPES.map((type) => {
          const Icon = LANDING_SECTION_SHAPES[type].icon;
          return (
            <li key={type}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent active:bg-accent/80"
                onClick={() => onPick(type)}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {t(`types.${type}.name`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`types.${type}.help`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const QuestionPicker = ({
  fields,
  onPick,
}: {
  fields: LandingField[];
  onPick: (question: PresetQuestion) => void;
}) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.questionnaire.${key}`);
  return (
    <div>
      <PopoverTitle>{t("add_question")}</PopoverTitle>
      <ul className="space-y-0.5">
        {availablePresets(fields).map((preset) => (
          <li key={preset.key}>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent active:bg-accent/80"
              onClick={() => onPick(preset)}
            >
              {t(`presets.${preset.key}`)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
