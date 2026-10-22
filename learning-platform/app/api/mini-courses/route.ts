import { apiError } from "@/lib/api";
import { requireCourseUser } from "@/lib/courses/auth";
import { listOwnedCourses } from "@/lib/courses/queries";

export async function GET() {
  try {
    const user = await requireCourseUser();
    return Response.json({ courses: await listOwnedCourses(user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  return Response.json(
    { error: "The mini-course API is read-only. Use /api/courses." },
    { status: 410 },
  );
}
