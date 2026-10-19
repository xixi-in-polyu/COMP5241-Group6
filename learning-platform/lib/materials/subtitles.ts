import { MaterialError, type SourceUnit } from "./types";

function timestampMs(value: string) {
  const match = value
    .trim()
    .replace(",", ".")
    .match(/(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/);
  if (!match) {
    throw new MaterialError(
      "TRANSCRIPT_INVALID",
      `Invalid subtitle timestamp: ${value}`,
    );
  }
  return (
    (Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3])) *
      1000 +
    Number(match[4])
  );
}

export function parseSubtitles(input: string): SourceUnit[] {
  const text = input
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/^WEBVTT[^\n]*\n+/, "");
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const units: SourceUnit[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [startRaw, endRawWithSettings] = lines[timingIndex].split("-->");
    const endRaw = endRawWithSettings.trim().split(/\s+/)[0];
    const startMs = timestampMs(startRaw);
    const endMs = timestampMs(endRaw);
    if (endMs <= startMs) {
      throw new MaterialError(
        "TRANSCRIPT_INVALID",
        "Subtitle cue end times must be after their start times.",
      );
    }
    const cue = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cue) {
      units.push({
        locator: {
          label: `${formatMs(startMs)}–${formatMs(endMs)}`,
          startMs,
          endMs,
        },
        text: cue,
      });
    }
  }

  if (!units.length) {
    throw new MaterialError(
      "TRANSCRIPT_EMPTY",
      "No timed subtitle cues were found.",
    );
  }
  return units;
}

export function formatMs(value: number) {
  const seconds = Math.floor(value / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
