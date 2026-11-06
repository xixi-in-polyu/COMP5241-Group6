"use client";

import { useEffect } from "react";

// Pages can be restored from the browser's back/forward cache after the user
// signs out. Re-check the session when that happens so protected pages do not
// reappear without a valid session.
export function SessionGuard() {
  useEffect(() => {
    async function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;

      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok && window.location.pathname !== "/") {
          window.location.replace("/");
        }
      } catch {
        // Offline or transient failure; keep the current page.
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
