import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Copy,
  CopyPlus,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  CanAccess,
  Navigate,
  useCanAccess,
  useDataProvider,
  useDelete,
  useGetList,
  useNotify,
  useRedirect,
  useTranslate,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { CreateButton } from "@/components/admin/create-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import {
  formatFechaHora,
  formatNumero,
  formatPorcentaje,
} from "../domain/format";
import type { Landing, LandingIndicadores } from "../domain/types";
import type { CrmDataProvider } from "../providers/dataProvider";
import { LandingPublishSwitch } from "./LandingPublishSwitch";
import { LandingThumbnail } from "./LandingThumbnail";
import { landingAddress, landingLeadsPath, landingUrl } from "./landingUrls";
import { useLandingPublishing } from "./useLandingPublishing";

const OVERVIEW_DAYS = 30;
// Sin la versión publicada: el listado no la muestra y puede ser pesada
const LIST_COLUMNS = [
  "id",
  "nombre",
  "slug",
  "estado",
  "borrador",
  "publicada_en",
  "creado_en",
  "actualizado_en",
];

const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="truncate text-xs text-muted-foreground">{label}</dt>
    <dd className="text-lg font-semibold tabular-nums">{value}</dd>
  </div>
);

const LandingCard = ({
  landing,
  overview,
  canDelete,
  onDelete,
}: {
  landing: Landing;
  overview?: LandingIndicadores;
  canDelete: boolean;
  onDelete: (landing: Landing) => void;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const t = (key: string, options?: object) =>
    translate(`resources.landings.list.${key}`, options);
  const publishing = useLandingPublishing({ landing });
  const isPublished = landing.estado === "publicada";
  const visits = overview?.visitas ?? 0;
  const leads = overview?.envios ?? 0;

  const copyLink = () =>
    navigator.clipboard
      .writeText(landingUrl(landing.slug))
      .then(() => notify(t("link_copied"), { type: "info" }))
      .catch(() => notify("crm.common.copy_error", { type: "error" }));

  // A copy is a new draft: it starts offline, with its own address
  const duplicate = useMutation({
    mutationFn: () =>
      dataProvider.create<Landing>("landings", {
        data: {
          nombre: `${landing.nombre} (${t("copy_suffix")})`,
          slug: `${landing.slug.slice(0, 50)}-${crypto.randomUUID().slice(0, 6)}`,
          borrador: landing.borrador,
        },
      }),
    onSuccess: ({ data }) => redirect("edit", "landings", data.id),
    onError: () => notify(t("copy_error"), { type: "error" }),
  });

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <Link
        to={`/landings/${landing.id}`}
        tabIndex={-1}
        aria-hidden
        className="block"
      >
        <LandingThumbnail content={landing.borrador} slug={landing.slug} />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              <Link to={`/landings/${landing.id}`} className="hover:underline">
                {landing.nombre}
              </Link>
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {landingAddress(landing.slug)}
            </p>
          </div>
          <LandingPublishSwitch
            className="shrink-0"
            isPublished={publishing.isPublished}
            isPending={publishing.isPending}
            onPublish={publishing.publish}
            onUnpublish={publishing.unpublish}
          />
        </div>

        <dl className="grid grid-cols-3 gap-2 border-y py-2">
          <Figure label={t("visits")} value={formatNumero(visits)} />
          <Figure label={t("leads_short")} value={formatNumero(leads)} />
          <Figure
            label={t("conversion")}
            value={visits ? formatPorcentaje(leads / visits) : "–"}
          />
        </dl>
        <p className="text-xs text-muted-foreground">
          {overview?.ultimo_envio
            ? t("last_lead", { date: formatFechaHora(overview.ultimo_envio) })
            : t("no_leads_yet")}
        </p>

        <div className="mt-auto flex items-center gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link to={`/landings/${landing.id}`}>
              {translate("ra.action.edit")}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                aria-label={t("more")}
                title={t("more")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPublished && (
                <>
                  <DropdownMenuItem asChild>
                    <a
                      href={landingUrl(landing.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink />
                      {t("open")}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={copyLink}>
                    <Copy />
                    {t("copy_link")}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to={landingLeadsPath(landing.id)}>
                  <Users />
                  {t("see_leads")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/landings/${landing.id}?tab=results`}>
                  <BarChart3 />
                  {t("see_results")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={duplicate.isPending}
                onSelect={() => duplicate.mutate()}
              >
                <CopyPlus />
                {t("duplicate")}
              </DropdownMenuItem>
              {/* Online pages are taken down first, with the switch */}
              {canDelete && !isPublished && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(landing)}
                  >
                    <Trash2 />
                    {translate("ra.action.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
};

export const LandingList = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [deleting, setDeleting] = useState<Landing | null>(null);
  const t = (key: string) => translate(`resources.landings.list.${key}`);
  const { canAccess: canDelete = false } = useCanAccess({
    resource: "landings",
    action: "delete",
  });
  const {
    data: landings = [],
    isPending,
    error,
  } = useGetList<Landing>(
    "landings",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "actualizado_en", order: "DESC" },
      meta: { columns: LIST_COLUMNS },
    },
    { retry: false },
  );
  const { data: overview = [] } = useQuery({
    queryKey: ["landing_overview", OVERVIEW_DAYS],
    queryFn: () => dataProvider.indicadoresLandings(OVERVIEW_DAYS),
    enabled: !isPending && !error,
    retry: false,
  });

  return (
    <CanAccess
      resource="landings"
      action="list"
      accessDenied={<Navigate to="/access-denied" />}
    >
      <div className="mt-4 flex flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {translate("resources.landings.name", { smart_count: 2 })}
            </h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="shrink-0">
            <CreateButton
              resource="landings"
              label="resources.landings.action.new"
              variant="default"
            />
          </div>
        </header>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {translate("crm.common.load_error")}
          </p>
        )}
        {isPending && !error && <Skeleton className="h-64 w-full" />}
        {!isPending && !error && !landings.length && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <Globe className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{t("empty")}</p>
            <p className="text-sm text-muted-foreground">{t("empty_help")}</p>
          </div>
        )}

        {landings.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("period")}</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {landings.map((landing) => (
            <LandingCard
              key={landing.id}
              landing={landing}
              overview={overview.find(
                (row) => String(row.landing_id) === String(landing.id),
              )}
              canDelete={canDelete}
              onDelete={setDeleting}
            />
          ))}
        </div>

        {deleting && (
          <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <TriangleAlert aria-hidden className="size-5 shrink-0" />
                  {translate("resources.landings.list.delete_title", {
                    name: deleting.nombre,
                  })}
                </DialogTitle>
                <DialogDescription>{t("delete_help")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => setDeleting(null)}
                >
                  {translate("ra.action.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  loading={isDeleting}
                  onClick={() =>
                    // The list drops the row from its cache: nothing to reload
                    deleteOne(
                      "landings",
                      { id: deleting.id, previousData: deleting },
                      {
                        mutationMode: "pessimistic",
                        onSuccess: () => setDeleting(null),
                        onError: () =>
                          notify(t("delete_error"), { type: "error" }),
                      },
                    )
                  }
                >
                  Eliminar definitivamente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </CanAccess>
  );
};
