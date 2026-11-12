import { AccountMenu } from "@/app/components/account-menu";
import { WorkspaceHeader } from "@/app/components/workspace-header";
import { requirePageRole } from "@/lib/auth/authorization";

import PrototypeStudio from "./prototype-studio";

export const metadata = { title: "Prototype Studio" };
export const instant = false;

export default async function StudioPage() {
  const student = await requirePageRole("student");

  return (
    <main className="min-h-screen bg-[#0f2740]">
      <div className="bg-white px-4 pt-4 text-slate-800 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <WorkspaceHeader breadcrumbs={[{ label: "Prototype Studio" }]} homeHref="/student">
            <AccountMenu user={student} />
          </WorkspaceHeader>
        </div>
      </div>
      <PrototypeStudio />
    </main>
  );
}
