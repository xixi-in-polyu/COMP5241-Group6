import { requirePageRole } from "@/lib/auth/authorization";

import TeacherPageClient from "./teacher-page-client";

export const instant = false;

export default async function TeacherPage() {
  await requirePageRole("teacher");
  return <TeacherPageClient />;
}
