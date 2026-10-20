import { execFileSync } from "node:child_process";

const base = process.argv[2];

if (!base) {
  throw new Error("Usage: npm run ci:migrations:check -- <base-git-ref>");
}

const changed = execFileSync(
  "git",
  ["diff", "--name-only", `${base}...HEAD`, "--", "prisma/migrations"],
  { encoding: "utf8" },
)
  .split("\n")
  .map((value) => value.trim())
  .filter((value) => value.endsWith("migration.sql"));

const destructivePatterns = [
  /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i,
  /\bALTER\s+(?:TABLE\s+\S+\s+)?COLUMN\s+\S+\s+TYPE\b/i,
  /\bSET\s+NOT\s+NULL\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
];

const warningPatterns = [/\bDROP\s+INDEX\b/i];

const violations = [];
const warnings = [];
for (const file of changed) {
  const content = execFileSync("git", ["show", `HEAD:${file}`], {
    encoding: "utf8",
  });
  for (const pattern of destructivePatterns) {
    if (pattern.test(content)) violations.push(`${file}: ${pattern.source}`);
  }
  for (const pattern of warningPatterns) {
    if (pattern.test(content)) warnings.push(`${file}: ${pattern.source}`);
  }
}

if (warnings.length) {
  console.warn("Migration SQL requiring an index/constraint review:");
  for (const warning of warnings) console.warn(`- ${warning}`);
  console.warn("Confirm the replacement preserves required uniqueness and query performance.");
}

if (violations.length && process.env.ALLOW_DESTRUCTIVE_MIGRATION !== "true") {
  console.error("Potentially destructive migration SQL detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    "Use an expand-contract migration. Exceptional changes must use the maintenance workflow.",
  );
  process.exit(1);
}

console.log(
  changed.length
    ? `Checked ${changed.length} changed migration file(s).`
    : "No changed migration files.",
);
