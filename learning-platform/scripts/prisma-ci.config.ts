import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const migrationsPath = process.env.CI_MIGRATIONS_PATH;

if (!url || !migrationsPath) {
  throw new Error(
    "DATABASE_URL_UNPOOLED (or DATABASE_URL) and CI_MIGRATIONS_PATH are required.",
  );
}

export default defineConfig({
  schema: "../prisma/schema.prisma",
  migrations: { path: migrationsPath },
  datasource: { url },
});
