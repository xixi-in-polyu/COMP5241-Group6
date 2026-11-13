import { AiSettingsClient } from "@/app/ai-settings/ai-settings-client";
import { PageShell } from "@/app/components/page-shell";
import { requirePageRoles } from "@/lib/auth/authorization";

export const instant = false;

export default async function AiSettingsPage() {
  const user = await requirePageRoles(["student", "teacher"]);

  return (
    <PageShell
      user={user}
      homeHref={user.role === "teacher" ? "/teacher" : "/student"}
      breadcrumbs={[{ label: "AI settings" }]}
      contentClassName="mt-6 max-w-2xl"
    >
      <AiSettingsClient />
    </PageShell>
  );
}
