import { requirePageRole } from "@/lib/auth/authorization";
import AssignmentCreate from "./assignment-create";

export const instant = false;

export default async function CreateAssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requirePageRole("teacher");
  const { courseId } = await params;
  return <AssignmentCreate courseId={courseId} />;
}
