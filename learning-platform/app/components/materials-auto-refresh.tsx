"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Materials are parsed by a background workflow. Re-render the page while any
// of them is still processing so the download link appears without a manual
// refresh; stop after a couple of minutes to avoid polling forever.
export function MaterialsAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const remaining = useRef(30);

  useEffect(() => {
    if (!active) return;
    remaining.current = 30;
    const timer = setInterval(() => {
      if (remaining.current <= 0) {
        clearInterval(timer);
        return;
      }
      remaining.current -= 1;
      router.refresh();
    }, 4_000);
    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
