import { readFileSync } from "node:fs";

const [file, ...required] = process.argv.slice(2);
if (!file || !required.length) {
  throw new Error(
    "Usage: node scripts/check-deployment-env.mjs <env-file> <NAME>...",
  );
}

const configured = new Set(
  readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)?.[1])
    .filter(Boolean),
);
const missing = required.filter((name) => !configured.has(name));

if (missing.length) {
  console.error(`Missing deployment environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Verified ${required.length} deployment environment variable names.`);
