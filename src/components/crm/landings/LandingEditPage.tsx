import { CanAccess, Navigate, useGetOne, useTranslate } from "ra-core";
import { useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";

import type { Landing } from "../domain/types";
import { LandingEditor } from "./LandingEditor";

/** `/landings/:id`: the editor, once the landing has loaded. */
export const LandingEditPage = () => {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const { data: landing, error } = useGetOne<Landing>(
    "landings",
    { id: Number(id) },
    // The editor keeps its own copy: a refetch would not reach it
    { enabled: !!id, retry: false, refetchOnWindowFocus: false },
  );

  return (
    <CanAccess
      resource="landings"
      action="edit"
      accessDenied={<Navigate to="/access-denied" />}
    >
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {translate("crm.common.load_error")}
        </p>
      ) : landing ? (
        <LandingEditor key={landing.id} landing={landing} />
      ) : (
        <Skeleton className="mt-4 h-[calc(100dvh-4rem)] w-full" />
      )}
    </CanAccess>
  );
};

export default LandingEditPage;
