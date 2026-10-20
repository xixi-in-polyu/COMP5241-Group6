import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const password = process.env.SMOKE_TEACHER_PASSWORD;

if (!url || !password) {
  throw new Error(
    "DATABASE_URL_UNPOOLED (or DATABASE_URL) and SMOKE_TEACHER_PASSWORD are required.",
  );
}

export const E2E_TEACHER_EMAIL = "ai-assignment-test@local.invalid";
export const E2E_TEACHER_ID = "10000000-0000-4000-8000-000000000001";
export const E2E_COURSE_ID = "20000000-0000-4000-8000-000000000001";
export const E2E_ASSIGNMENT_ID = "30000000-0000-4000-8000-000000000001";

const questions = Array.from({ length: 20 }, (_, index) => ({
  id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  origin: "teacher_authored" as const,
  type: "short_answer" as const,
  objective: "comprehension" as const,
  difficulty: index < 6 ? "easy" : index < 16 ? "medium" : "hard",
  entityIds: [],
  prompt: `Explain the usability concept demonstrated in scenario ${index + 1}.`,
  options: [],
  answer: "A grounded explanation of the relevant usability principle.",
  explanation: "This deterministic question is used only by the Preview E2E test.",
  score: 5,
  evidenceRefs: [],
  warnings: [],
}));

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

try {
  await prisma.$transaction(async (tx) => {
    await tx.assignment.deleteMany({ where: { id: E2E_ASSIGNMENT_ID } });
    await tx.course.deleteMany({ where: { id: E2E_COURSE_ID } });

    await tx.user.upsert({
      where: { email: E2E_TEACHER_EMAIL },
      update: { password, role: "teacher" },
      create: {
        id: E2E_TEACHER_ID,
        email: E2E_TEACHER_EMAIL,
        password,
        role: "teacher",
      },
    });

    await tx.course.create({
      data: {
        id: E2E_COURSE_ID,
        teacherId: E2E_TEACHER_ID,
        title: "Preview E2E course",
        description: "Synthetic data for the isolated Preview deployment.",
        status: "READY",
        phase: "Ready",
      },
    });

    await tx.assignment.create({
      data: {
        id: E2E_ASSIGNMENT_ID,
        courseId: E2E_COURSE_ID,
        title: "Twenty-question smoke assignment",
        status: "DRAFT",
        phase: "Review generated questions",
        originalBrief: {
          title: "Twenty-question smoke assignment",
          instructions: "Review the deterministic Preview questions.",
          count: 20,
          types: ["short_answer"],
          difficulty: { easy: 30, medium: 50, hard: 20 },
          objectives: ["comprehension"],
          coverageEntityIds: [],
        } satisfies Prisma.InputJsonValue,
        questions: questions satisfies Prisma.InputJsonValue,
        failedSlots: [],
        qualityWarnings: [],
      },
    });
  });

  console.log(
    JSON.stringify({
      email: E2E_TEACHER_EMAIL,
      courseId: E2E_COURSE_ID,
      assignmentId: E2E_ASSIGNMENT_ID,
    }),
  );
} finally {
  await prisma.$disconnect();
}
