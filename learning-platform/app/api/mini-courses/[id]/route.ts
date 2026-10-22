import { apiError, ApiError } from "@/lib/api";
import { requireCourseUser } from "@/lib/courses/auth";
import { getCourseByLegacyId, getOwnedCourse } from "@/lib/courses/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCourseUser();
    const { id } = await params;
    const direct = await getOwnedCourse(user.id, id);
    if (direct) return Response.json({ course: direct });
    const mapped = await getCourseByLegacyId(user.id, id);
    if (!mapped) throw new ApiError(404, "Course not found.");
    const course = await getOwnedCourse(user.id, mapped.id);
    return Response.json({ course });
  } catch (error) {
    return apiError(error);
  }
}

const gone = () => Response.json(
  { error: "The mini-course API is read-only. Use /api/courses." },
  { status: 410 },
);

export async function PATCH() {
  return gone();
}

export async function DELETE() {
  return gone();
}
