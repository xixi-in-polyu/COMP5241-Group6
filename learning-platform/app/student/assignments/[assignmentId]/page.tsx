import { requirePageRole } from "@/lib/auth/authorization";
import InteractiveLabStudentPage from "./student-labs-client";

export const instant = false;

export default async function StudentAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  await requirePageRole("student");
  const { assignmentId } = await params;
  return <InteractiveLabStudentPage assignmentId={assignmentId} />;
}
