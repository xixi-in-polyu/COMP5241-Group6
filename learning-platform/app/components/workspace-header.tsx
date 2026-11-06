import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function WorkspaceHeader({
  children,
  homeHref,
}: {
  children?: ReactNode;
  homeHref?: string;
}) {
  const title = (
    <>
      <BookOpen aria-hidden="true" className="size-6 shrink-0" />
      <span className="truncate">Learning Platform</span>
    </>
  );

  return (
    <header className="flex h-16 w-full shrink-0 items-center justify-between gap-3 border-b-2 border-slate-200 dark:border-slate-700">
      <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-[-0.01em] text-[#193b61]">
        {homeHref ? (
          <Link
            className="flex min-w-0 items-center gap-2 rounded-lg transition-colors hover:text-[#24496f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            href={homeHref}
          >
            {title}
          </Link>
        ) : (
          title
        )}
      </h1>
      {children}
    </header>
  );
}
