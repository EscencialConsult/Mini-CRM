import { useCallback, useState } from "react";

/** The size of an element, kept up to date: pass the returned ref to it. */
export const useElementSize = <T extends HTMLElement = HTMLDivElement>() => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
};
