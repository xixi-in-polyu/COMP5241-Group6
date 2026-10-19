import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const password = process.env.TEST_TEACHER_PASSWORD;
if (!url || !password) throw new Error("DATABASE_URL and TEST_TEACHER_PASSWORD are required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
await prisma.user.upsert({ where: { email: "ai-assignment-test@local.invalid" }, update: { role: "teacher", password }, create: { email: "ai-assignment-test@local.invalid", role: "teacher", password } });
await prisma.$disconnect();
