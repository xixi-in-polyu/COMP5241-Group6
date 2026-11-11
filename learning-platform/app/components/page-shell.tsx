import type { ReactNode } from "react";

import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader, type Breadcrumb } from "@/app/components/workspace-header";

export function PageShell({
  user,
  homeHref,
  breadcrumbs,
  children,
  contentClassName = "mt-6",
}: {
  user?: { id: string; email: string };
  homeHref?: string;
  breadcrumbs?: Breadcrumb[];
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col">
        <WorkspaceHeader breadcrumbs={breadcrumbs} homeHref={homeHref}>
          {user ? <AccountMenu user={user} /> : null}
        </WorkspaceHeader>
        <div className={contentClassName}>{children}</div>
      </div>
    </main>
  );
}
