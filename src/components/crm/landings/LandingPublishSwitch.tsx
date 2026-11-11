import { useTranslate } from "ra-core";
import { useId, useState } from "react";
import { Confirm } from "@/components/admin/confirm";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Online or not, in the editor and in the list alike. Taking a page down asks
 * first: the ads and links that lead there stop working.
 */
export const LandingPublishSwitch = ({
  isPublished,
  isPending,
  disabled,
  onPublish,
  onUnpublish,
  className,
}: {
  isPublished: boolean;
  isPending?: boolean;
  disabled?: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  className?: string;
}) => {
  const translate = useTranslate();
  const id = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Switch
          id={id}
          checked={isPublished}
          disabled={disabled || isPending}
          aria-busy={isPending || undefined}
          onCheckedChange={(checked) =>
            checked ? onPublish() : setIsConfirming(true)
          }
        />
        <Label htmlFor={id} className="font-normal whitespace-nowrap">
          {translate(
            `resources.landings.status.${isPublished ? "published" : "draft"}`,
          )}
        </Label>
      </div>
      <Confirm
        isOpen={isConfirming}
        title="resources.landings.editor.settings.offline_confirm"
        content="resources.landings.editor.settings.offline_confirm_help"
        confirm="resources.landings.editor.unpublish"
        confirmColor="warning"
        onClose={() => setIsConfirming(false)}
        onConfirm={() => {
          setIsConfirming(false);
          onUnpublish();
        }}
      />
    </>
  );
};
