import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { RaRecord } from "ra-core";
import {
  useCanAccess,
  useCreatePath,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useRecordContext,
  useResourceContext,
  useResourceTranslation,
} from "ra-core";
import { Link } from "react-router";

export type EditButtonProps = {
  record?: RaRecord;
  resource?: string;
  label?: string;
};

/**
 * A button that navigates to the edit page for a record.
 *
 * Works within RecordContext to automatically get the record ID.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/editbutton/ EditButton documentation}
 *
 * @example
 * import { DataTable, EditButton } from '@/components/admin';
 *
 * const PostList = () => (
 *   <DataTable>
 *     <DataTable.Col source="title" />
 *     <DataTable.Col source="author" />
 *     <DataTable.Col source="published_at" />
 *     <DataTable.Col>
 *       <EditButton />
 *     </DataTable.Col>
 *   </DataTable>
 * );
 */
export const EditButton = (props: EditButtonProps) => {
  const { label: labelProp } = props;
  const resource = useResourceContext(props);
  const record = useRecordContext(props);
  const createPath = useCreatePath();
  const getResourceLabel = useGetResourceLabel();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const recordRepresentationValue = getRecordRepresentation(record);
  const recordRepresentation =
    typeof recordRepresentationValue === "string"
      ? recordRepresentationValue
      : recordRepresentationValue?.toString();
  const link = createPath({
    resource,
    type: "edit",
    id: record?.id,
  });
  const label = useResourceTranslation({
    resourceI18nKey: resource ? `resources.${resource}.action.edit` : undefined,
    baseI18nKey: "ra.action.edit",
    options: {
      name: resource ? getResourceLabel(resource, 1) : undefined,
      recordRepresentation,
    },
    userText: labelProp,
  });
  const { canAccess } = useCanAccess({ resource, action: "edit", record });
  // Hidden from users who may not edit (e.g. read-only users)
  if (!canAccess) return null;
  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      to={link}
      onClick={stopPropagation}
      aria-label={typeof label === "string" ? label : undefined}
    >
      <Pencil />
      {label}
    </Link>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
