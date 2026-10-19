import { beforeEach, describe, expect, it, vi } from "vitest";

const getBasicInfo = vi.fn();
vi.mock("youtubei.js", () => ({
  Innertube: {
    create: vi.fn(async () => ({ getBasicInfo })),
  },
}));

import { parseSubtitles } from "@/lib/materials/subtitles";
import {
  fetchYouTubeCaptions,
  parseYouTubeVideoId,
  selectEnglishTrack,
} from "@/lib/materials/youtube-captions";

const captionPayload = JSON.stringify({
  events: [
    {
      tStartMs: 1_000,
      dDurationMs: 2_000,
      segs: [{ utf8: "Build" }, { utf8: " pipeline" }],
    },
    {
      tStartMs: 3_000,
      dDurationMs: 1_500,
      segs: [{ utf8: "Run tests" }],
    },
  ],
});

function info(tracks: Array<Record<string, unknown>>) {
  return {
    basic_info: {
      title: "Lesson",
      duration: 120,
      is_live: false,
      is_live_content: false,
    },
    playability_status: { status: "OK" },
    captions: { caption_tracks: tracks },
  };
}

describe("YouTube caption adapter", () => {
  beforeEach(() => {
    getBasicInfo.mockReset();
  });

  it("accepts supported URL forms and rejects arbitrary hosts", () => {
    const id = "EJyuu6zlQCg";
    expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://youtube.com/shorts/${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://youtube.com/embed/${id}`)).toBe(id);
    expect(() =>
      parseYouTubeVideoId(`https://example.com/watch?v=${id}`),
    ).toThrow(/Only public YouTube/);
  });

  it("prefers manual English over automatic English", () => {
    const automatic = {
      base_url: "https://www.youtube.com/api/timedtext?a=1",
      language_code: "en",
      kind: "asr" as const,
    };
    const manual = {
      base_url: "https://www.youtube.com/api/timedtext?a=2",
      language_code: "en-US",
    };
    expect(selectEnglishTrack([automatic, manual])).toBe(manual);
  });

  it("extracts automatic captions and retries one transient failure", async () => {
    getBasicInfo.mockResolvedValue(
      info([
        {
          base_url: "https://www.youtube.com/api/timedtext?v=test",
          language_code: "en",
          kind: "asr",
        },
      ]),
    );
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response(captionPayload, { status: 200 }));
    const attempts: Array<{
      operation: string;
      attempt: number;
      status: string;
    }> = [];
    const result = await fetchYouTubeCaptions(
      "https://www.youtube.com/watch?v=EJyuu6zlQCg",
      {
        fetch: request,
        onAttempt: (event) => {
          attempts.push(event);
        },
      },
    );

    expect(result.mode).toBe("automatic_caption");
    expect(result.units[0]).toEqual({
      locator: { label: "00:01–00:03", startMs: 1_000, endMs: 3_000 },
      text: "Build pipeline",
    });
    expect(
      attempts.filter((event) => event.operation === "caption_fetch"),
    ).toMatchObject([
      { attempt: 1, status: "provider_error" },
      { attempt: 2, status: "success" },
    ]);
  });

  it("requires an exposed English caption track", async () => {
    getBasicInfo.mockResolvedValue(
      info([
        {
          base_url: "https://www.youtube.com/api/timedtext?v=test",
          language_code: "fr",
        },
      ]),
    );
    await expect(
      fetchYouTubeCaptions("https://youtu.be/EJyuu6zlQCg"),
    ).rejects.toMatchObject({ code: "YOUTUBE_CAPTIONS_REQUIRED" });
  });

  it("rejects live or over-limit videos", async () => {
    getBasicInfo.mockResolvedValue({
      ...info([]),
      basic_info: { duration: 1_801, is_live: false, is_live_content: false },
    });
    await expect(
      fetchYouTubeCaptions("https://youtu.be/EJyuu6zlQCg"),
    ).rejects.toMatchObject({ code: "YOUTUBE_DURATION_EXCEEDED" });
  });
});

describe("transcript parsing", () => {
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
