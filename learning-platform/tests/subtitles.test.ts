import { describe, expect, it } from "vitest";
import {
  parseSubtitles,
  validateTranscriptMetadata,
} from "@/lib/materials/subtitles";

describe("transcript parsing", () => {
  it("accepts TXT, SRT, and VTT transcript metadata", () => {
    expect(() => validateTranscriptMetadata("lesson.txt", "text/plain", 100)).not.toThrow();
    expect(() => validateTranscriptMetadata("lesson.srt", "application/x-subrip", 100)).not.toThrow();
    expect(() => validateTranscriptMetadata("lesson.vtt", "text/vtt", 100)).not.toThrow();
    expect(() => validateTranscriptMetadata("lesson.pdf", "application/pdf", 100)).toThrow(/TXT, SRT, and VTT/);
  });

  it("normalizes SRT and VTT cues into timestamped units", () => {
    const srt = `1\n00:00:01,000 --> 00:00:03,000\nBuild <b>the pipeline</b>.`;
    const vtt = `WEBVTT\n\n00:03.000 --> 00:04.500 align:start\nRun tests.`;

    expect(parseSubtitles(srt)).toEqual([
      {
        locator: { label: "00:01–00:03", startMs: 1_000, endMs: 3_000 },
        text: "Build the pipeline.",
      },
    ]);
    expect(parseSubtitles(vtt)[0].text).toBe("Run tests.");
  });

  it("rejects empty or invalid timed transcripts", () => {
    expect(() => parseSubtitles("Plain text without timing")).toThrow(
      /No timed subtitle cues/,
    );
    expect(() =>
      parseSubtitles("00:00:03.000 --> 00:00:01.000\nBackwards"),
    ).toThrow(/end times/);
  });
});
