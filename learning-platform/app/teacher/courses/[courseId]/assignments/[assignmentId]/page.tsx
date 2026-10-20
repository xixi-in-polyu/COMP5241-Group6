import { requirePageRole } from "@/lib/auth/authorization";
import AssignmentEditor from "./assignment-editor";

export const instant = false;

export default async function AssignmentPage({ params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  await requirePageRole("teacher");
  const { courseId, assignmentId } = await params;
  return <AssignmentEditor courseId={courseId} assignmentId={assignmentId}/>;
}
