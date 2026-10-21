import type { Prisma } from "@prisma/client";

import { ApiError, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireMiniCourseUser, requireOwnedMiniCourse } from "@/lib/mini-courses/api-auth";
import { BACKGROUND_TO_DB, LEVEL_TO_DB, STATUS_TO_DB } from "@/lib/mini-courses/db-enums";
import { getMiniCourse } from "@/lib/mini-courses/queries";
import { coursePatchSchema } from "@/lib/mini-courses/validation";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMiniCourseUser();
    const { id } = await params;
    const course = await getMiniCourse(user.id, id);
    if (!course) {
      throw new ApiError(404, "Mini-course not found.");
    }
    return Response.json({ course });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMiniCourseUser();
    const { id } = await params;
    await requireOwnedMiniCourse(id, user.id);

    const patch = coursePatchSchema.parse(await request.json());

    await prisma.$transaction(async (tx) => {
      await tx.miniCourse.update({
        where: { id },
        data: {
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.summary === undefined ? {} : { summary: patch.summary }),
          ...(patch.subject === undefined ? {} : { subject: patch.subject }),
          ...(patch.audience === undefined ? {} : { audience: patch.audience }),
          ...(patch.objectives === undefined ? {} : { objectives: json(patch.objectives) }),
          ...(patch.resources === undefined ? {} : { resources: json(patch.resources) }),
          ...(patch.level === undefined ? {} : { level: LEVEL_TO_DB[patch.level] }),
          ...(patch.background === undefined
            ? {}
            : { background: BACKGROUND_TO_DB[patch.background] }),
          ...(patch.durationMinutes === undefined
            ? {}
            : { durationMinutes: patch.durationMinutes }),
          ...(patch.language === undefined ? {} : { language: patch.language }),
          ...(patch.status === undefined ? {} : { status: STATUS_TO_DB[patch.status] }),
        },
      });

      if (patch.chapters) {
        // The editor always sends the whole chapter list, so replacing it keeps
        // the write atomic and avoids reconciling block ids on every keystroke.
        await tx.miniCourseChapter.deleteMany({ where: { courseId: id } });
        for (const [chapterIndex, chapter] of patch.chapters.entries()) {
          await tx.miniCourseChapter.create({
            data: {
              courseId: id,
              ordinal: chapterIndex + 1,
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
            },
          });
        }
      }
    });

    const course = await getMiniCourse(user.id, id);
    return Response.json({ course });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMiniCourseUser();
    const { id } = await params;
    await requireOwnedMiniCourse(id, user.id);
    await prisma.miniCourse.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
