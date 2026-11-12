import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import {
  CanAccess,
  Navigate,
  useDataProvider,
  useNotify,
  useRedirect,
  useTranslate,
} from "ra-core";
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { Landing } from "../domain/types";
import { isValidSlug, toSlug } from "./pagina/schema.ts";
import { LandingThumbnail } from "./LandingThumbnail";
import { buildLandingTemplate, LANDING_TEMPLATES } from "./landingTemplates";
import { LANDINGS_HOST } from "./landingUrls";

/** A landing always starts from a template: nobody faces a blank page. */
export const LandingCreate = () => {
  const translate = useTranslate();
  const t = (key: string) => translate(`resources.landings.create.${key}`);
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const [template, setTemplate] = useState(LANDING_TEMPLATES[0].id);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugBlurred, setSlugBlurred] = useState(false);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");

  const thumbnails = useMemo(
    () =>
      LANDING_TEMPLATES.map(({ id }) => ({
        id,
        content: buildLandingTemplate(id),
      })),
    [],
  );

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      dataProvider.create<Landing>("landings", {
        data: {
          nombre: name.trim(),
          slug,
          borrador: buildLandingTemplate(template, { company, email }),
        },
      }),
    onSuccess: ({ data }) => redirect("edit", "landings", data.id),
    onError: () => notify(t("error"), { type: "error" }),
  });

  const changeName = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  };
  const isSlugOk = isValidSlug(slug);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSlugBlurred(true);
    if (name.trim() && isSlugOk) mutate();
  };
  const showSlugError = slugBlurred && !!slug && !isSlugOk;
  const submitDisabled = !name.trim() || !isSlugOk;

  // Radiogroup: one tab stop, arrows move (with wrap) and select
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const moveTemplate = (event: KeyboardEvent<HTMLDivElement>) => {
    const total = LANDING_TEMPLATES.length;
    const current = LANDING_TEMPLATES.findIndex(({ id }) => id === template);
    let target: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = (current + 1) % total;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = (current - 1 + total) % total;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = total - 1;
    } else {
      return;
    }
    event.preventDefault();
    const next = LANDING_TEMPLATES[target].id;
    setTemplate(next);
    cards.current.get(next)?.focus();
  };

  return (
    <CanAccess
      resource="landings"
      action="create"
      accessDenied={<Navigate to="/access-denied" />}
    >
      <div className="mx-auto mt-4 w-full max-w-5xl space-y-4">
        <Link
          to="/landings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {translate("resources.landings.name", { smart_count: 2 })}
        </Link>
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("help")}</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("template")}</legend>
            <div
              role="radiogroup"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onKeyDown={moveTemplate}
            >
              {thumbnails.map(({ id, content }) => {
                const selected = template === id;
                const { primaryColor, background } = content.design;
                return (
                  <button
                    key={id}
                    ref={(node) => {
                      if (node) cards.current.set(id, node);
                      else cards.current.delete(id);
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-labelledby={`template-${id}-name`}
                    aria-describedby={`template-${id}-help`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTemplate(id)}
                    className={cn(
                      "relative min-w-0 overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      selected && "border-primary ring-1 ring-primary",
                    )}
                  >
                    <span aria-hidden="true" className="block">
                      <LandingThumbnail content={content} slug="" />
                    </span>
                    <span className="block p-3">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-5 shrink-0 rounded-full border border-border"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor} 45%, ${background.color2} 100%)`,
                            }}
                          />
                          <span
                            id={`template-${id}-name`}
                            className="min-w-0 truncate"
                          >
                            {translate(
                              `resources.landings.templates.${id}.name`,
                            )}
                          </span>
                        </span>
                        {selected && (
                          <Check
                            aria-hidden="true"
                            className="size-4 shrink-0 text-primary"
                          />
                        )}
                      </span>
                      <span
                        id={`template-${id}-help`}
                        className="mt-0.5 block text-sm text-muted-foreground"
                      >
                        {translate(`resources.landings.templates.${id}.help`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="landing-name">{t("name")}</Label>
              <Input
                id="landing-name"
                value={name}
                onChange={(event) => changeName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("name_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landing-slug">{t("slug")}</Label>
              <div className="flex items-center gap-1">
                <span className="min-w-0 shrink truncate text-sm text-muted-foreground">
                  {LANDINGS_HOST}/
                </span>
                <Input
                  id="landing-slug"
                  value={slug}
                  className="min-w-0 basis-40 grow"
                  aria-invalid={showSlugError || undefined}
                  aria-describedby="landing-slug-message"
                  onBlur={() => setSlugBlurred(true)}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(event.target.value.toLowerCase());
                  }}
                />
              </div>
              {showSlugError ? (
                <p
                  id="landing-slug-message"
                  className="text-xs text-destructive"
                >
                  {t("slug_invalid")}
                </p>
              ) : (
                <p
                  id="landing-slug-message"
                  className="text-xs text-muted-foreground"
                >
                  {t("slug_hint")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landing-company">{t("company")}</Label>
              <Input
                id="landing-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("company_hint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landing-email">{t("email")}</Label>
              <Input
                id="landing-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("email_hint")}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Button
              type="submit"
              loading={isPending}
              disabled={submitDisabled}
              aria-describedby={
                submitDisabled ? "landing-submit-reason" : undefined
              }
            >
              {t("submit")}
            </Button>
            {submitDisabled && (
              <p
                id="landing-submit-reason"
                className="text-xs text-muted-foreground"
              >
                {t("submit_disabled")}
              </p>
            )}
          </div>
        </form>
      </div>
    </CanAccess>
  );
};
