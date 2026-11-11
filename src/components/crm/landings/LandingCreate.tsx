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
import { useMemo, useState, type FormEvent } from "react";
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
            <div className="grid gap-3 md:grid-cols-3">
              {thumbnails.map(({ id, content }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={template === id}
                  onClick={() => setTemplate(id)}
                  className={cn(
                    "relative overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary/60",
                    template === id && "border-primary ring-1 ring-primary",
                  )}
                >
                  <LandingThumbnail content={content} slug="" />
                  <span className="block p-3">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {translate(`resources.landings.templates.${id}.name`)}
                      {template === id && (
                        <Check className="size-4 shrink-0 text-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {translate(`resources.landings.templates.${id}.help`)}
                    </span>
                  </span>
                </button>
              ))}
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

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={isPending}
              disabled={!name.trim() || !isSlugOk}
            >
              {t("submit")}
            </Button>
          </div>
        </form>
      </div>
    </CanAccess>
  );
};
