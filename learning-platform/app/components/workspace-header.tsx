import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type Breadcrumb = { label: string; href?: string };

export function WorkspaceHeader({
  children,
  homeHref,
  breadcrumbs = [],
}: {
  children?: ReactNode;
  homeHref?: string;
  breadcrumbs?: Breadcrumb[];
}) {
  const logo = (
    <>
      <BookOpen aria-hidden="true" className="size-6 shrink-0" />
      <span className="truncate">Learning Platform</span>
    </>
  );

  return (
    <header className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b-2 border-slate-200">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
        {homeHref ? (
          <Link
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg text-2xl font-bold tracking-[-0.01em] text-[#193b61] transition-colors hover:text-[#24496f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            href={homeHref}
          >
            {logo}
          </Link>
        ) : (
          <h1 className="flex min-w-0 shrink-0 items-center gap-2 text-2xl font-bold tracking-[-0.01em] text-[#193b61]">
            {logo}
          </h1>
        )}

        {breadcrumbs.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${index}`}>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
            {crumb.href ? (
              <Link
                className="truncate text-2xl font-semibold tracking-[-0.01em] text-slate-500 transition-colors hover:text-[#193b61]"
                href={crumb.href}
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-2xl font-semibold tracking-[-0.01em] text-slate-400">
                {crumb.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      {children}
    </header>
  );
}
