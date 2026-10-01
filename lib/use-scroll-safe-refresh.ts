"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/** router.refresh() re-renders the current route's Server Components, but visibly jumps
 *  scroll to the top of the page when it does — disruptive on a long grid of room cards.
 *  Capture and restore the scroll position across the refresh instead. Double rAF waits for
 *  the post-refresh DOM to actually paint before restoring, since a single frame is too early. */
export function useScrollSafeRefresh() {
  const router = useRouter();

  return useCallback(() => {
    const scrollY = window.scrollY;
    router.refresh();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY });
      });
    });
  }, [router]);
}
