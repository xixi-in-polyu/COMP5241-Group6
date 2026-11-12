import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectPath = path.join(contentDir, "published.animation.json");
const versionPath = path.join(contentDir, "versions", "published.animation-v4.json");

const files = {
  "asset-deploy-bigbang": "deploy-big-bang.svg",
  "asset-deploy-progressive": "deploy-progressive.svg",
  "asset-deploy-canary": "deploy-canary.svg",
  "asset-secret-boundary": "secret-boundary.svg",
};

const project = JSON.parse(await readFile(projectPath, "utf8"));

for (const asset of project.assets ?? []) {
  const file = files[asset.id];
  if (!file) continue;
  const data = await readFile(path.join(contentDir, "assets", file));
  asset.uri = `data:image/svg+xml;base64,${data.toString("base64")}`;
  asset.sha256 = createHash("sha256").update(data).digest("hex");
  asset.width = 1600;
  asset.height = 900;
  asset.embedded = true;
}

const serialized = `${JSON.stringify(project, null, 2)}\n`;
await writeFile(projectPath, serialized);
await writeFile(versionPath, serialized);
console.log(`Re-embedded ${Object.keys(files).length} illustrations into the published project.`);
