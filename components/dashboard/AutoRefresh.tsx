"use client";

import { useEffect } from "react";
import { useScrollSafeRefresh } from "@/lib/use-scroll-safe-refresh";

/** Keeps the (server-rendered) dashboard in sync without a manual reload — refreshes on a
 *  fixed interval regardless of tab visibility (a paused-when-hidden timer left a background
 *  tab stuck showing stale data even minutes later), plus immediately on refocus so switching
 *  back to the tab never waits for the next tick. */
export function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const refresh = useScrollSafeRefresh();

  useEffect(() => {
    const timer = setInterval(refresh, intervalMs);

    function handleFocus() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh, intervalMs]);

  return null;
}
