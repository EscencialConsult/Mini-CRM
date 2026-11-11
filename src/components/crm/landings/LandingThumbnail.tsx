import { type CSSProperties, useMemo } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { cn } from "@/lib/utils";

import { renderLandingPage } from "./pagina/render.ts";
import { normalizeLandingContent } from "./pagina/schema.ts";

/** A small picture of a page for lists and pickers: nothing in it can be used. */
export const LandingThumbnail = ({
  content,
  slug,
  className,
}: {
  content: unknown;
  slug: string;
  className?: string;
}) => {
  const [boxRef, box] = useElementSize();
  const html = useMemo(
    () =>
      renderLandingPage(normalizeLandingContent(content), {
        slug,
        submitUrl: "",
        preview: true,
      }),
    [content, slug],
  );
  return (
    <div
      ref={boxRef}
      aria-hidden
      className={cn(
        "relative h-40 overflow-hidden border-b bg-muted",
        className,
      )}
    >
      {box.width > 0 && (
        <iframe
          title=""
          sandbox=""
          srcDoc={html}
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 h-[900px] w-[1280px] origin-top-left scale-(--thumb-scale) bg-white"
          style={{ "--thumb-scale": box.width / 1280 } as CSSProperties}
        />
      )}
    </div>
  );
};
