import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CircleAlert,
  ExternalLink,
  HelpCircle,
  Loader2,
  Redo2,
  Undo2,
} from "lucide-react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { Pill } from "../shared/badges";

import {
  findPublishProblems,
  isValidSlug,
  LANDING_PROBLEMS,
  type LandingProblem,
  normalizeLandingContent,
} from "./pagina/schema.ts";
import type { CrmDataProvider } from "../providers/dataProvider";
import type { Landing } from "../domain/types";
import { LandingCanvas, type LandingCanvasHandle } from "./LandingCanvas";
import {
  type LandingEditorTab,
  type LandingEditorTarget,
  SETTINGS_ANCHORS,
} from "./landingChecklist";
import { LandingPublishSwitch } from "./LandingPublishSwitch";
import { LandingResultsTab } from "./LandingResultsTab";
import { LandingSettingsTab } from "./LandingSettingsTab";
import { LandingStyleMenu } from "./LandingStyleMenu";
import { landingAddress, landingUrl } from "./landingUrls";
import {
  updateCachedLanding,
  useLandingPublishing,
} from "./useLandingPublishing";
import { useLandingDraft } from "./useLandingDraft";

const AUTOSAVE_DELAY_MS = 1500;
const EDITOR = "resources.landings.editor";

type SaveState = "saved" | "pending" | "saving" | "invalid" | "error";
type EditorProblem = LandingProblem | "slug_invalid";

const KNOWN_PROBLEMS: readonly string[] = [...LANDING_PROBLEMS, "slug_invalid"];

const SaveIndicator = ({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.save_state.${key}`);
  if (state === "error" || state === "invalid") {
    return (
      <span
        role="alert"
        className="inline-flex items-center gap-1 text-sm text-destructive"
      >
        <AlertCircle className="size-3.5" />
        {t(state)}
        {state === "error" && (
          <button type="button" className="underline" onClick={onRetry}>
            {t("retry")}
          </button>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      {state === "saved" ? (
        <Check className="size-3.5" />
      ) : (
        <Loader2 className="size-3.5 motion-safe:animate-spin" />
      )}
      {t(state === "saved" ? "saved" : "saving")}
    </span>
  );
};

/** Typing in a field of the editor keeps its own undo. */
const isTextInput = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * A short guide to the three tabs and how to publish, one click away from
 * anywhere in the editor.
 */
const EditorHelp = () => {
  const translate = useTranslate();
  const t = (key: string) => translate(`${EDITOR}.help.${key}`);
  const steps: LandingEditorTab[] = ["design", "settings", "results"];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <HelpCircle />
          {t("open")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-sm font-semibold">{t("title")}</p>
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step} className="flex gap-2 text-sm">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span>
                <span className="font-medium">
                  {translate(`${EDITOR}.tabs.${step}`)}:{" "}
                </span>
                {t(step)}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t pt-3 text-sm text-muted-foreground">
          {t("publish")}
        </p>
      </PopoverContent>
    </Popover>
  );
};

/**
 * The editor of a landing: the page edited in place, what is not seen on it in
 * Settings, and its numbers in Results. Saved as you go.
 */
export const LandingEditor = ({ landing: initial }: { landing: Landing }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const canvasRef = useRef<LandingCanvasHandle>(null);

  const [landing, setLanding] = useState(initial);
  const [name, setName] = useState(initial.nombre);
  const [slug, setSlug] = useState(initial.slug);
  // The list links straight to the results
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<LandingEditorTab>(
    searchParams.get("tab") === "results" ? "results" : "design",
  );
  const [target, setTarget] = useState<LandingEditorTarget | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [serverProblems, setServerProblems] = useState<string[]>([]);

  // Every edit counts: a save only clears the "pending" of what it carried
  const editCount = useRef(0);
  const edited = useCallback(() => {
    editCount.current += 1;
    setSaveState("pending");
  }, []);
  const { content, patch, undo, redo, canUndo, canRedo } = useLandingDraft(
    () => normalizeLandingContent(initial.borrador),
    edited,
  );

  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ landing, name, slug, content });
  useEffect(() => {
    latest.current = { landing, name, slug, content };
  }, [landing, name, slug, content]);

  const canSave = name.trim() !== "" && isValidSlug(slug);

  /** One save at a time, in order: an old one cannot overwrite a newer one. */
  const saveNow = useCallback(() => {
    const run = async () => {
      const { landing: current, name, slug, content } = latest.current;
      const carried = editCount.current;
      setSaveState("saving");
      try {
        const { data } = await dataProvider.update<Landing>("landings", {
          id: current.id,
          data: { nombre: name.trim(), slug, borrador: content },
          previousData: current,
        });
        setLanding(data);
        updateCachedLanding(queryClient, data);
        setSaveState(carried === editCount.current ? "saved" : "pending");
      } catch (error) {
        setSaveState("error");
        throw error;
      }
    };
    const next = saveChain.current.catch(() => undefined).then(run);
    saveChain.current = next;
    return next;
  }, [dataProvider, queryClient]);

  useEffect(() => {
    if (saveState !== "pending") return;
    if (!canSave) {
      setSaveState("invalid");
      return;
    }
    const timer = setTimeout(() => {
      saveNow().catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [saveState, content, name, slug, canSave, saveNow]);

  // Fixing the name or the address resumes the saving that was waiting for it
  useEffect(() => {
    if (saveState === "invalid" && canSave) setSaveState("pending");
  }, [saveState, canSave]);

  // Leaving before the delay runs out must not lose the last edits
  const hasUnsaved = useRef(false);
  useEffect(() => {
    hasUnsaved.current =
      canSave && (saveState === "pending" || saveState === "error");
  }, [saveState, canSave]);
  useEffect(
    () => () => {
      if (hasUnsaved.current) saveNow().catch(() => undefined);
    },
    [saveNow],
  );

  const goTo = useCallback((next: LandingEditorTarget) => {
    setTab(next.tab);
    setTarget(next);
  }, []);

  // Once the tab is in view, the place it was asked for is brought into view
  useEffect(() => {
    if (!target || target.tab !== tab) return;
    if (target.tab === "design") canvasRef.current?.scrollTo(target.anchor);
    else {
      document
        .getElementById(target.anchor)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTarget(null);
  }, [target, tab]);

  const publishing = useLandingPublishing({
    landing,
    prepare: saveNow,
    onUpdated: (updated) => {
      setLanding(updated);
      setServerProblems([]);
    },
    onProblems: (problems) => {
      setServerProblems(problems);
      goTo({ tab: "settings", anchor: SETTINGS_ANCHORS.checklist });
    },
  });

  const problems = useMemo(
    () =>
      [
        ...new Set<string>([
          ...findPublishProblems(content),
          ...(isValidSlug(slug) ? [] : ["slug_invalid"]),
          ...serverProblems,
        ]),
      ].filter((problem): problem is EditorProblem =>
        KNOWN_PROBLEMS.includes(problem),
      ),
    [content, slug, serverProblems],
  );
  const isPublished = landing.estado === "publicada";
  // Both normalized: the database does not keep the order of the keys
  const hasUnpublishedChanges = useMemo(
    () =>
      isPublished &&
      JSON.stringify(normalizeLandingContent(landing.publicada)) !==
        JSON.stringify(normalizeLandingContent(content)),
    [isPublished, landing.publicada, content],
  );

  /** Publishing waits until nothing is missing: the checklist says what. */
  const whenReady = (action: () => void) => {
    if (problems.length > 0 || !canSave) {
      notify(`${EDITOR}.cannot_publish`, {
        type: "warning",
        messageArgs: { smart_count: Math.max(problems.length, 1) },
      });
      goTo({ tab: "settings", anchor: SETTINGS_ANCHORS.checklist });
      return;
    }
    action();
  };

  // Undo and redo while on the page, unless a field has its own
  useEffect(() => {
    if (tab !== "design") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTextInput(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab, undo, redo]);

  const tabs: LandingEditorTab[] = ["design", "settings", "results"];

  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-[34rem] flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={translate("resources.landings.name", {
              smart_count: 2,
            })}
            title={translate("resources.landings.name", {
              smart_count: 2,
            })}
          >
            <Link to="/landings">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2">
              <h1 className="truncate text-lg font-semibold">{name}</h1>
              <SaveIndicator
                state={saveState}
                onRetry={() => saveNow().catch(() => undefined)}
              />
            </div>
            {isPublished && (
              <a
                href={landingUrl(slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {landingAddress(slug)}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {hasUnpublishedChanges && (
            <Pill tono="aviso">
              {translate(`${EDITOR}.changes_pending`)}
            </Pill>
          )}
          {problems.length > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
              onClick={() =>
                goTo({ tab: "settings", anchor: SETTINGS_ANCHORS.checklist })
              }
            >
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {translate(`${EDITOR}.checklist.pending`, {
                smart_count: problems.length,
              })}
            </button>
          )}
          {hasUnpublishedChanges && (
            <Button
              type="button"
              size="sm"
              loading={publishing.isPublishing}
              disabled={publishing.isPending}
              onClick={() => whenReady(publishing.publishChanges)}
            >
              {translate(`${EDITOR}.update_published`)}
            </Button>
          )}
          <LandingPublishSwitch
            isPublished={publishing.isPublished}
            isPending={publishing.isPending}
            onPublish={() => whenReady(publishing.publish)}
            onUnpublish={publishing.unpublish}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as LandingEditorTab)}
        >
          <TabsList>
            {tabs.map((item) => (
              <TabsTrigger key={item} value={item}>
                {translate(`${EDITOR}.tabs.${item}`)}
                {item === "settings" && problems.length > 0 && (
                  <>
                    <span
                      aria-hidden
                      className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground"
                    >
                      {problems.length}
                    </span>
                    <span className="sr-only">
                      {translate(`${EDITOR}.checklist.pending`, {
                        smart_count: problems.length,
                      })}
                    </span>
                  </>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <EditorHelp />
      </div>

      {/* The canvas stays mounted: coming back keeps where the page was */}
      <div className={cn("flex min-h-0 flex-1", tab !== "design" && "hidden")}>
        <LandingCanvas
          ref={canvasRef}
          content={content}
          slug={slug}
          patch={patch}
          onUndo={undo}
          onRedo={redo}
          toolbar={
            <>
              <LandingStyleMenu content={content} patch={patch} />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={!canUndo}
                aria-label={translate(`${EDITOR}.canvas.undo`)}
                title={translate(`${EDITOR}.canvas.undo`)}
                onClick={undo}
              >
                <Undo2 />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={!canRedo}
                aria-label={translate(`${EDITOR}.canvas.redo`)}
                title={translate(`${EDITOR}.canvas.redo`)}
                onClick={redo}
              >
                <Redo2 />
              </Button>
              <span className="text-xs text-muted-foreground">
                {translate(`${EDITOR}.canvas.hint`)}
              </span>
            </>
          }
        />
      </div>
      {tab === "settings" && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <LandingSettingsTab
            content={content}
            patch={patch}
            name={name}
            onNameChange={(value) => {
              setName(value);
              edited();
            }}
            slug={slug}
            onSlugChange={(value) => {
              setSlug(value);
              edited();
            }}
            landing={landing}
            problems={problems}
            onGoTo={goTo}
          />
        </div>
      )}
      {tab === "results" && (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <LandingResultsTab landing={landing} />
        </div>
      )}
    </div>
  );
};
