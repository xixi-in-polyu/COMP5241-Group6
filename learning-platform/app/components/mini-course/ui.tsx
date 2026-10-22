import type { ReactNode } from "react";

/**
 * Small presentational primitives owned by the mini-course feature.
 *
 * They live under `app/components/mini-course/` on purpose: the rest of the
 * app writes Tailwind classes inline, and this file should not become a
 * project-wide design system without a separate discussion.
 */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

type BadgeTone = "neutral" | "info" | "success" | "warning";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[#eef2f6] text-[#4a5d72]",
  info: "bg-[#e8eef7] text-[#24496f]",
  success: "bg-[#e5f2ea] text-[#1c6b43]",
  warning: "bg-[#fdf1e3] text-[#8a5312]",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
