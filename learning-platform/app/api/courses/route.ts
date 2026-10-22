import { apiError } from "@/lib/api";
import { assertCourseWritesEnabled, requireCourseUser } from "@/lib/courses/auth";
import { createUnifiedCourse } from "@/lib/courses/content";
import { getOwnedCourse, listOwnedCourses } from "@/lib/courses/queries";
import { courseCreateSchema } from "@/lib/courses/validation";

export async function GET(request: Request) {
  try {
    const user = await requireCourseUser();
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("scope") === "archived";
    return Response.json({ courses: await listOwnedCourses(user.id, includeArchived) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertCourseWritesEnabled();
    const user = await requireCourseUser();
    const raw = await request.json() as Record<string, unknown>;
    const input = courseCreateSchema.parse({ ...raw, subject: raw.subject ?? raw.category ?? "" });
    const created = await createUnifiedCourse(user, input);
    return Response.json({ course: await getOwnedCourse(user.id, created.id) }, { status: 201 });
  } catch (error) {
    const response = apiError(error);
    if (response.status === 503) response.headers.set("Retry-After", "300");
    return response;
  }
}
