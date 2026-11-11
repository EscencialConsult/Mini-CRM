import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useState } from "react";

import type { CrmDataProvider } from "../providers/dataProvider";
import type { Landing } from "../domain/types";

type PublishError = Error & { problems?: string[] };

/** Only this landing changes: the lists and the record show it without a reload. */
export const updateCachedLanding = (
  queryClient: QueryClient,
  landing: Landing,
) => {
  const isThis = (row: Landing) => String(row.id) === String(landing.id);
  queryClient.setQueriesData<{ data: Landing[] }>(
    { queryKey: ["landings", "getList"] },
    (cached) =>
      cached && {
        ...cached,
        data: cached.data.map((row) => (isThis(row) ? landing : row)),
      },
  );
  queryClient.setQueriesData<Landing>(
    { queryKey: ["landings", "getOne"] },
    (cached) => (cached && isThis(cached) ? landing : cached),
  );
};

/**
 * Puts a landing online or takes it down. The switch moves at once and goes
 * back, with a notice, if the server refuses.
 */
export const useLandingPublishing = ({
  landing,
  prepare,
  onUpdated,
  onProblems,
}: {
  landing?: Landing;
  /** Runs before publishing, like saving the last edits */
  prepare?: () => Promise<unknown>;
  onUpdated?: (landing: Landing) => void;
  /** What is missing to publish; without it, a notice says how many things */
  onProblems?: (problems: string[]) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [shown, setShown] = useState<boolean | null>(null);

  const applied = (updated: Landing) => {
    updateCachedLanding(queryClient, updated);
    onUpdated?.(updated);
  };
  const failed = () =>
    notify("resources.landings.editor.publish_error", { type: "error" });

  const publish = useMutation({
    mutationFn: async () => {
      if (!landing) throw new Error("landing_missing");
      await prepare?.();
      return dataProvider.publicarLanding(landing.id);
    },
    onSuccess: (updated) => {
      applied(updated);
      notify("resources.landings.editor.published", { type: "success" });
    },
    onError: (error: PublishError) => {
      if (!error.problems?.length) {
        failed();
        return;
      }
      if (onProblems) {
        onProblems(error.problems);
        return;
      }
      notify("resources.landings.editor.cannot_publish", {
        type: "warning",
        messageArgs: { smart_count: error.problems.length },
      });
    },
    onSettled: () => setShown(null),
  });

  const unpublish = useMutation({
    mutationFn: () => {
      if (!landing) throw new Error("landing_missing");
      return dataProvider.despublicarLanding(landing.id);
    },
    onSuccess: (updated) => {
      applied(updated);
      notify("resources.landings.editor.unpublished", { type: "info" });
    },
    onError: failed,
    onSettled: () => setShown(null),
  });

  return {
    isPublished: shown ?? landing?.estado === "publicada",
    isPending: publish.isPending || unpublish.isPending,
    isPublishing: publish.isPending,
    publish: () => {
      setShown(true);
      publish.mutate();
    },
    /** Sends the newest edits of a landing that is already online */
    publishChanges: () => publish.mutate(),
    unpublish: () => {
      setShown(false);
      unpublish.mutate();
    },
  };
};
