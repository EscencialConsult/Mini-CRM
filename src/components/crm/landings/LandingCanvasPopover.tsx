import { Trash2, X } from "lucide-react";
import { useTranslate } from "ra-core";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

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
 * Panel de opciones del elemento elegido en el lienzo. Va acoplado a la
 * derecha del lienzo (a pantalla completa en alto y con scroll propio), no
 * flotando sobre la página: así nunca queda recortado ni tapa lo que se edita.
 * En pantallas angostas sube desde abajo.
 */
export const LandingCanvasPanel = ({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) => {
  const translate = useTranslate();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={translate(`${EDITOR}.canvas.panel`, {
        _: "Opciones del elemento",
      })}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[65dvh] flex-col border-t bg-card shadow-2xl outline-none lg:static lg:z-auto lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-lg lg:border lg:shadow-none"
    >
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {translate(`${EDITOR}.canvas.panel`, { _: "Opciones" })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={translate("ra.action.close", { _: "Cerrar" })}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
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
