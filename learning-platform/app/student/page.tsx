import { requirePageRole } from "@/lib/auth/authorization";

import StudentPageClient from "./student-page-client";

export const instant = false;

export default async function StudentPage() {
  await requirePageRole("student");
  return <StudentPageClient />;
}
