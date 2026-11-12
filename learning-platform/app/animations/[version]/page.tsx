import { notFound } from "next/navigation";

import { getPublishedVersion } from "@/animation-studio/content/versions/registry";
import { requirePageRoles } from "@/lib/auth/authorization";

import { AnimationStudioPage } from "../animation-studio-page";

export const instant = false;

export const metadata = {
  title: "Animation version | Learning Platform",
};

export default async function AnimationVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const selected = getPublishedVersion(version);

  if (!selected) {
    notFound();
  }

  const user = await requirePageRoles(["teacher", "student"]);

  return (
    <AnimationStudioPage
      exitHref="/animations"
      project={selected.project}
      readOnly={user.role === "student"}
      versionLabel={selected.id.toUpperCase()}
    />
  );
}
