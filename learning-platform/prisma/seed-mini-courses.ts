import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

config({ path: ".env.local" });
config();

/**
 * Seeds software-development mini-courses so the workspace and reader can be
 * used without an AI key. Everything here is invented sample content.
 *
 * Owner resolution order:
 *   1. SEED_OWNER_EMAIL, when set
 *   2. the oldest existing account
 *   3. a demo account created for the seed
 */
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to seed mini-courses.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type SeedBlock = { type: "HEADING" | "TEXT" | "ACTIVITY" | "SUMMARY"; payload: Record<string, unknown> };

type SeedCourse = {
  title: string;
  summary: string;
  subject: string;
  audience: string;
  objectives: string[];
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  background: "BEGINNER" | "EXPERIENCED";
  durationMinutes: number;
  resources: { id: string; kind: string; title: string; url: string }[];
  chapters: { title: string; blocks: SeedBlock[] }[];
};

const COURSES: SeedCourse[] = [
  {
    title: "Debugging JavaScript like a professional",
    summary:
      "Turn a vague bug report into a failing test, a fix you trust, and a regression test that keeps it fixed.",
    subject: "Web development",
    audience: "Developers who can already write basic JavaScript",
    objectives: [
      "Read a stack trace and find the line that actually fails",
      "Shrink a bug into a minimal reproduction",
      "Fix a defect without breaking existing behaviour",
    ],
    level: "INTERMEDIATE",
    background: "EXPERIENCED",
    durationMinutes: 45,
    resources: [
      {
        id: "seed-debug-resource-1",
        kind: "link",
        title: "MDN: JavaScript error reference",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors",
      },
    ],
    chapters: [
      {
        title: "Reading a stack trace",
        blocks: [
          { type: "HEADING", payload: { text: "Reading a stack trace" } },
          {
            type: "TEXT",
            payload: {
              text: "A stack trace reads from the inside out: the top frame is where the error was thrown, and the frames below are how the program got there. Find the first frame that belongs to your own code rather than to a library, then read the arguments it was called with. That frame is usually where the wrong value was produced, not where it was noticed.",
            },
          },
          {
            type: "SUMMARY",
            payload: {
              text: "Find the first frame in your own code, and state the expected value before editing anything.",
            },
          },
        ],
      },
      {
        title: "Building a minimal reproduction",
        blocks: [
          { type: "HEADING", payload: { text: "Building a minimal reproduction" } },
          {
            type: "TEXT",
            payload: {
              text: "A reproduction is minimal when removing any remaining line makes the bug disappear. Copy the failing path into a blank file, delete everything that is not needed, and run it again after each deletion. The bug survives fewer lines than you expect, and the lines that survive are the ones worth reading.",
            },
          },
          {
            type: "ACTIVITY",
            payload: {
              instruction: "Put the debugging steps into a sensible order.",
              items: [
                { id: "seed-step-1", text: "Reproduce the failure with the smallest possible input" },
                { id: "seed-step-2", text: "Read the stack trace and find the failing line" },
                { id: "seed-step-3", text: "Change one thing, then run it again" },
                { id: "seed-step-4", text: "Add a test that pins the fix in place" },
              ],
            },
          },
          {
            type: "SUMMARY",
            payload: { text: "Delete until the bug disappears, then keep the lines that remain." },
          },
        ],
      },
      {
        title: "Pinning the fix with a regression test",
        blocks: [
          { type: "HEADING", payload: { text: "Pinning the fix with a regression test" } },
          {
            type: "TEXT",
            payload: {
              text: "The regression test should fail on the old code and pass on the new one, and it should exercise the same boundary the reproduction exposed: empty input, a rejected promise, a record that does not exist. If the test passes before the fix, it is testing something else.",
            },
          },
          {
            type: "SUMMARY",
            payload: {
              text: "A regression test earns its place by failing on the old behaviour and describing the promise, not the patch.",
            },
          },
        ],
      },
    ],
  },
  {
    title: "Version control from zero",
    summary:
      "What a commit really is, why branches are cheap, and how to undo mistakes without losing work.",
    subject: "Developer tooling",
    audience: "Students who have never used Git before",
    objectives: [
      "Explain what a commit records and why messages matter",
      "Create and switch branches without fear",
      "Recover from a wrong commit or a bad merge",
    ],
    level: "BEGINNER",
    background: "BEGINNER",
    durationMinutes: 30,
    resources: [],
    chapters: [
      {
        title: "What a commit actually is",
        blocks: [
          { type: "HEADING", payload: { text: "What a commit actually is" } },
          {
            type: "TEXT",
            payload: {
              text: "A commit is a snapshot of every tracked file plus a pointer to the commit before it. Nothing is stored as a difference you have to replay by hand; the history is a chain of snapshots, and a branch is just a name pointing at one of them.",
            },
          },
          {
            type: "SUMMARY",
            payload: {
              text: "A commit is a snapshot with a parent; a branch is a movable name for one snapshot.",
            },
          },
        ],
      },
      {
        title: "Branching without fear",
        blocks: [
          { type: "HEADING", payload: { text: "Branching without fear" } },
          {
            type: "TEXT",
            payload: {
              text: "Creating a branch costs almost nothing, so the habit worth building is one branch per unit of work. It keeps unfinished experiments out of the shared branch, and it makes the review small enough that people actually read it.",
            },
          },
          {
            type: "SUMMARY",
            payload: {
              text: "One branch per unit of work, and never switch with uncommitted changes you care about.",
            },
          },
        ],
      },
    ],
  },
];

/**
 * Picks the account that will own the sample courses.
 *
 * It never creates an account: a seeded login would have no usable password and
 * the samples would be invisible to everybody. Register first, then either set
 * SEED_OWNER_EMAIL or let it fall back to the oldest account.
 */
async function resolveOwnerId(): Promise<string> {
  const requested = process.env.SEED_OWNER_EMAIL?.trim();
  if (requested) {
    const user = await prisma.user.findUnique({ where: { email: requested } });
    if (!user) {
      throw new Error(`No account found for SEED_OWNER_EMAIL=${requested}. Register it first.`);
    }
    return user.id;
  }

  const existing = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    return existing.id;
  }

  throw new Error(
    "No account exists yet. Register an account in the app first, then run the seed again (or pass SEED_OWNER_EMAIL).",
  );
}

async function main() {
  const ownerId = await resolveOwnerId();
  const reset = process.env.SEED_RESET === "1";

  if (reset) {
    await prisma.miniCourse.deleteMany({ where: { ownerId } });
    console.log("SEED_RESET=1: removed the existing courses of this owner first.");
  }

  let created = 0;
  let skipped = 0;

  for (const course of COURSES) {
    const existing = await prisma.miniCourse.findFirst({
      where: { ownerId, title: course.title },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.miniCourse.create({
      data: {
        ownerId,
        title: course.title,
        summary: course.summary,
        subject: course.subject,
        audience: course.audience,
        objectives: course.objectives,
        resources: course.resources,
        level: course.level,
        background: course.background,
        durationMinutes: course.durationMinutes,
        language: "en",
        status: "PUBLISHED",
        chapters: {
          create: course.chapters.map((chapter, chapterIndex) => ({
            ordinal: chapterIndex + 1,
            title: chapter.title,
            blocks: {
              create: chapter.blocks.map((block, blockIndex) => ({
                ordinal: blockIndex + 1,
                type: block.type,
                payload: block.payload as Prisma.InputJsonValue,
              })),
            },
          })),
        },
      },
    });
    created += 1;
  }

  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { email: true } });
  console.log(
    `Mini-courses: created ${created}, skipped ${skipped} already present, owner ${owner?.email ?? ownerId}.`,
  );
}

await main();
await prisma.$disconnect();
