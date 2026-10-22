import type { Prisma } from "@prisma/client";

import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMiniCourseUser } from "@/lib/mini-courses/api-auth";
import { BACKGROUND_TO_DB, LEVEL_TO_DB } from "@/lib/mini-courses/db-enums";
import { listMiniCourses } from "@/lib/mini-courses/queries";
import { courseInputSchema } from "@/lib/mini-courses/validation";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function GET() {
  try {
    const user = await requireMiniCourseUser();
    return Response.json({ courses: await listMiniCourses(user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMiniCourseUser();
    const input = courseInputSchema.parse(await request.json());

    const course = await prisma.miniCourse.create({
      data: {
        ownerId: user.id,
        title: input.title,
        summary: input.summary,
        subject: input.subject,
        audience: input.audience,
        objectives: json(input.objectives),
        resources: json(input.resources),
        level: LEVEL_TO_DB[input.level],
        background: BACKGROUND_TO_DB[input.background],
        durationMinutes: input.durationMinutes,
        language: input.language,
        status: "DRAFT",
        chapters: {
          create: input.chapters.map((chapter, index) => ({
            ordinal: index + 1,
            title: chapter.title,
            objectives: json(chapter.objectives),
            resources: json(chapter.resources),
            blocks: {
              create: chapter.blocks.map((block, blockIndex) => {
                const payload = { ...block } as Record<string, unknown>;
                const blockType = String(payload.type).toUpperCase();
                delete payload.id;
                delete payload.type;
                return {
                  ordinal: blockIndex + 1,
                  type: blockType as Prisma.MiniCourseBlockCreateManyChapterInput["type"],
                  payload: json(payload),
                };
              }),
            },
          })),
        },
      },
      select: { id: true },
    });

    return Response.json({ course }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
