import { useTranslate } from "ra-core";

import {
  LANDING_FIELD_TARGETS,
  type LandingField,
  type LandingFieldType,
} from "./pagina/schema.ts";
import { newFieldId } from "./landingTemplates";

export type PresetQuestion = Pick<LandingField, "label" | "type" | "target"> & {
  key: string;
  options?: string[];
  required?: boolean;
};

/** The questions everybody ends up adding. Their text is what visitors read. */
export const PRESET_QUESTIONS: PresetQuestion[] = [
  {
    key: "email",
    label: "Email",
    type: "email",
    target: "email",
    required: true,
  },
  { key: "phone", label: "Teléfono", type: "phone", target: "phone" },
  { key: "company", label: "Empresa", type: "text", target: "company" },
  { key: "title", label: "Cargo", type: "text", target: "title" },
  {
    key: "size",
    label: "¿Cuántas personas trabajan en tu empresa?",
    type: "select",
    target: "answer",
    options: ["1 a 10", "11 a 50", "51 a 200", "Más de 200"],
  },
  {
    key: "mode",
    label: "¿Cómo prefieres cursar?",
    type: "radio",
    target: "answer",
    options: ["En línea", "Presencial", "Todavía no lo sé"],
  },
  {
    key: "comments",
    label: "Comentarios",
    type: "textarea",
    target: "message",
  },
  { key: "blank", label: "", type: "text", target: "answer" },
];

export const fieldFromPreset = ({
  label,
  type,
  target,
  options = [],
  required = false,
}: PresetQuestion): LandingField => ({
  id: newFieldId(),
  label,
  type,
  target,
  options,
  required,
});

/** Presets whose lead column is not taken yet; plain answers can repeat. */
export const availablePresets = (fields: LandingField[]) => {
  const used = fields.map((field) => field.target);
  return PRESET_QUESTIONS.filter(
    (preset) => preset.target === "answer" || !used.includes(preset.target),
  );
};

/** The type of question suggests where the answer belongs. */
export const targetForType = (type: LandingFieldType, current: string) => {
  if (type === "email") return "email";
  if (type === "phone") return "phone";
  return current === "email" || current === "phone" ? "answer" : current;
};

/** Where an answer can be stored: a client column, or the note of the submission. */
export const useFieldTargets = () => {
  const translate = useTranslate();
  return LANDING_FIELD_TARGETS.map((target) => ({
    value: target,
    label: translate(
      `resources.landings.editor.questionnaire.targets.${target}`,
    ),
  }));
};
