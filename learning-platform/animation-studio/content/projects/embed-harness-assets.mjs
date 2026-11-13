import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectsDir = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.dirname(projectsDir);
const projectPath = path.join(projectsDir, "harness-intro.animation.json");

const files = {
  "asset-harness-model-alone": "harness-model-alone.svg",
  "asset-harness-layers": "harness-layers.svg",
  "asset-harness-loop": "harness-loop.svg",
  "asset-harness-compare": "harness-compare.svg",
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

await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`);
console.log(`Re-embedded ${Object.keys(files).length} harness illustrations.`);
