"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps the (server-rendered) dashboard in sync without a manual reload — refreshes
 *  periodically while the tab is visible, and immediately when it regains focus (covers
 *  "I made a change on another page/device and came back here"). Paused in the background
 *  so an idle tab doesn't keep hitting the server. */
export function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
