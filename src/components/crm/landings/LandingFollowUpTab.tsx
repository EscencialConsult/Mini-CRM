import { Check } from "lucide-react";
import { useTranslate } from "ra-core";
import { useMemo } from "react";

import { SelectorEtiquetas } from "../etiquetas/SelectorEtiquetas";
import { useEtiquetas } from "../etiquetas/useEtiquetas";
import { useUsuarios } from "../shared/useUsuarios";
import {
  EditorSection,
  type PatchLanding,
  PickField,
  TextField,
} from "./landingControls";
import type { LandingContent } from "./pagina/schema.ts";

const FOLLOW_UP = "resources.landings.editor.follow_up";
const DUE_DAYS = [0, 1, 2, 3, 5, 7, 14, 30];

/**
 * What the CRM does with every submission of this landing: the client goes to
 * an administrator, with a note of the answers and, if set, a follow-up task.
 * landing_recibir (database) applies it; nothing here reaches a visitor.
 */
export const LandingFollowUpTab = ({
  content,
  patch,
}: {
  content: LandingContent;
  patch: PatchLanding;
}) => {
  const translate = useTranslate();
  const t = (key: string, options?: object) =>
    translate(`${FOLLOW_UP}.${key}`, options);
  const { usuarios } = useUsuarios();
  const { porId: etiquetasPorId } = useEtiquetas();
  const { adminId, taskTitle, taskDueInDays, tagIds } = content.automation;
  const tagNames = tagIds.flatMap((id) => {
    const etiqueta = etiquetasPorId.get(id);
    return etiqueta ? `«${etiqueta.nombre}»` : [];
  });

  // In the order the database picks "the first active one"
  const admins = useMemo(
    () =>
      usuarios
        .filter((usuario) => usuario.rol === "administrador" && usuario.activo)
        .sort((a, b) => a.creado_en.localeCompare(b.creado_en)),
    [usuarios],
  );
  const nameOf = (id: string | null) => {
    const admin = admins.find((usuario) => usuario.id === id) ?? admins[0];
    return admin ? `${admin.nombre} ${admin.apellido}` : "";
  };
  const firstName = nameOf(null);
  const when =
    taskDueInDays === 0
      ? t("when_today")
      : t("when_days", { smart_count: taskDueInDays });

  const summary = [
    t("client_new", { name: nameOf(adminId) || t("admin_first") }),
    t("client_known"),
    t("note"),
    ...(tagNames.length
      ? [t("tags_summary", { names: tagNames.join(", ") })]
      : []),
    taskTitle.trim()
      ? t("task", { title: taskTitle.trim(), when })
      : t("task_none"),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-muted/40 p-3">
        <h3 className="mb-2 text-sm font-semibold">{t("summary")}</h3>
        <ul className="space-y-1.5 text-sm">
          {summary.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <EditorSection title={t("admin")} help={t("admin_hint")}>
        <PickField
          label={t("admin")}
          value={
            adminId && admins.some((admin) => admin.id === adminId)
              ? adminId
              : ""
          }
          emptyLabel={
            firstName
              ? t("admin_first_named", { name: firstName })
              : t("admin_first")
          }
          choices={admins.map((admin) => ({
            value: admin.id,
            label: `${admin.nombre} ${admin.apellido}`,
          }))}
          onChange={(value) =>
            patch((draft) => {
              draft.automation.adminId = value || null;
            })
          }
        />
      </EditorSection>

      <EditorSection title={t("tags")} help={t("tags_hint")}>
        <SelectorEtiquetas
          aria-label={t("tags_label")}
          value={tagIds}
          onChange={(ids) =>
            patch((draft) => {
              draft.automation.tagIds = ids;
            })
          }
        />
      </EditorSection>

      <EditorSection title={t("task_title")}>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <TextField
            label={t("task_title")}
            value={taskTitle}
            placeholder={t("task_placeholder")}
            onChange={(value) =>
              patch(
                (draft) => {
                  draft.automation.taskTitle = value;
                },
                { mergeKey: "automation.taskTitle" },
              )
            }
          />
          <PickField
            label={t("task_due")}
            value={String(taskDueInDays)}
            choices={[...new Set([...DUE_DAYS, taskDueInDays])]
              .sort((a, b) => a - b)
              .map((days) => ({
                value: String(days),
                label:
                  days === 0
                    ? t("when_today")
                    : t("when_days", { smart_count: days }),
              }))}
            onChange={(value) =>
              patch((draft) => {
                draft.automation.taskDueInDays = Number(value);
              })
            }
          />
        </div>
      </EditorSection>
    </div>
  );
};
