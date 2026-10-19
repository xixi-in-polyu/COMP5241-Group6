import { createHash } from "node:crypto";
import type { SourceUnit } from "./types";

export type SegmentDraft = SourceUnit & { ordinal: number; hash: string };
const MAX_CHARS = 8_000;
const MAX_OVERLAP = 800;

function digest(text: string, locator: SourceUnit["locator"]) {
  return createHash("sha256").update(JSON.stringify(locator)).update("\0").update(text).digest("hex");
}

export function segmentUnits(units: SourceUnit[]): SegmentDraft[] {
  const normalized = units.map((unit) => ({ ...unit, text: unit.text.replace(/\s+/g, " ").trim() })).filter((unit) => unit.text);
  const output: SegmentDraft[] = [];
  let current: SourceUnit[] = [];
  let length = 0;
  const flush = () => {
    if (!current.length) return;
    const text = current.map((unit) => unit.text).join("\n");
    const first = current[0].locator;
    const last = current.at(-1)!.locator;
    const locator = current.length === 1 ? first : { ...first, label: `${first.label}–${last.label}` };
    output.push({ text, locator, ordinal: output.length, hash: digest(text, locator) });
    const overlap = current.at(-1)!;
    current = overlap.text.length <= MAX_OVERLAP ? [overlap] : [];
    length = current.length ? overlap.text.length : 0;
  };
  for (const unit of normalized) {
    if (unit.text.length > MAX_CHARS) {
      flush();
      for (let offset = 0; offset < unit.text.length; offset += MAX_CHARS) {
        const text = unit.text.slice(offset, offset + MAX_CHARS);
        output.push({ ...unit, text, ordinal: output.length, hash: digest(text, unit.locator) });
      }
      current = [];
      length = 0;
      continue;
    }
    if (current.length && length + unit.text.length + 1 > MAX_CHARS) flush();
    current.push(unit);
    length += unit.text.length + 1;
  }
  flush();
  return output.filter((segment, index) => index === 0 || segment.hash !== output[index - 1].hash);
}
