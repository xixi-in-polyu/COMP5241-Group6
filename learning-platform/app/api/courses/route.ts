import { z } from "zod";
import { apiError, requireTeacherApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({ title: z.string().trim().min(1).max(120), category: z.string().trim().max(80).optional(), description: z.string().trim().max(4_000).default("") });

export async function GET() {
  try {
    const teacher = await requireTeacherApi();
    const courses = await prisma.course.findMany({ where: { teacherId: teacher.id }, include: { _count: { select: { materials: true, assignments: true } } }, orderBy: { updatedAt: "desc" } });
    return Response.json({ courses });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacherApi();
    const input = createSchema.parse(await request.json());
    const course = await prisma.course.create({ data: { ...input, teacherId: teacher.id, phase: "Upload source materials" } });
    return Response.json({ course }, { status: 201 });
  } catch (error) { return apiError(error); }
}
