import publishedProject from "@/animation-studio/content/published.animation.json";
import { requirePageRoles } from "@/lib/auth/authorization";

import { AnimationStudioPage } from "./animation-studio-page";

export const instant = false;

export const metadata = {
  title: "Animation | Learning Platform",
};

export default async function AnimationsRoute() {
  const user = await requirePageRoles(["teacher", "student"]);

  return (
    <AnimationStudioPage
      exitHref={user.role === "teacher" ? "/teacher" : "/student"}
      project={publishedProject}
      readOnly={user.role === "student"}
    />
  );
}
