import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

try {
  await prisma.$executeRaw`
    INSERT INTO "User" ("id", "email", "password", "role")
    VALUES (
      '50000000-0000-4000-8000-000000000001',
      'migration-upgrade@local.invalid',
      'synthetic-not-a-secret',
      'teacher'
    )
    ON CONFLICT ("email") DO NOTHING
  `;
} finally {
  await prisma.$disconnect();
}
