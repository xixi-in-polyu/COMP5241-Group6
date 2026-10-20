import { Innertube } from "youtubei.js";
import { MaterialError, type SourceUnit } from "./types";
import { formatMs } from "./subtitles";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_DURATION_SECONDS = 30 * 60;
const MAX_CAPTION_BYTES = 2 * 1024 * 1024;
const MAX_CUES = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
const OPERATION_TIMEOUT_MS = 45_000;

export type CaptionMode = "manual_caption" | "automatic_caption";
export type CaptionAttempt = {
  operation: "youtube_metadata" | "caption_fetch";
  attempt: number;
  retryReason?: string;
  durationMs: number;
  status: "success" | "provider_error" | "validation_error";
  errorCode?: string;
  errorDetail?: string;
  resourceMetrics?: Record<string, unknown>;
};

export type YouTubeCaptionResult = {
  videoId: string;
  title: string;
  durationSeconds: number;
  mode: CaptionMode;
  units: SourceUnit[];
};

type CaptionTrack = {
  base_url: string;
  language_code: string;
  kind?: "asr" | "frc";
};

type Options = {
  fetch?: typeof fetch;
  onAttempt?: (event: CaptionAttempt) => void | Promise<void>;
};

class RetryableRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export function parseYouTubeVideoId(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new MaterialError(
      "YOUTUBE_VIDEO_UNAVAILABLE",
      "Enter a valid public YouTube URL.",
    );
  }

  const host = url.hostname.toLowerCase();
  let id = "";
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v") || "";
    } else {
      const [kind, candidate] = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed"].includes(kind)) id = candidate || "";
    }
  }

  if (!VIDEO_ID.test(id)) {
    throw new MaterialError(
      "YOUTUBE_VIDEO_UNAVAILABLE",
      "Only public YouTube watch, short, embed, and youtu.be links are supported.",
    );
  }
  return id;
}

export async function fetchYouTubeCaptions(
  sourceUrl: string,
  options: Options = {},
): Promise<YouTubeCaptionResult> {
  const videoId = parseYouTubeVideoId(sourceUrl);
  const deadline = Date.now() + OPERATION_TIMEOUT_MS;
  const request = restrictedFetch(options.fetch || fetch, deadline);
  const info = await withRetry(
    "youtube_metadata",
    () => loadVideo(videoId, request),
    options.onAttempt,
  );
  let durationSeconds = parseDurationSeconds(info.basic_info.duration);
  if (info.basic_info.is_live || info.basic_info.is_live_content) {
    throw new MaterialError(
      "YOUTUBE_DURATION_EXCEEDED",
      "Only non-live YouTube videos up to 30 minutes are supported.",
    );
  }
  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw new MaterialError(
      "YOUTUBE_DURATION_EXCEEDED",
      "Only non-live YouTube videos up to 30 minutes are supported.",
    );
  }
  const status = info.playability_status?.status;
  if (status && status !== "OK") {
    throw new MaterialError(
      "YOUTUBE_VIDEO_UNAVAILABLE",
      info.playability_status?.reason || "The YouTube video is unavailable.",
    );
  }
  const tracks = (info.captions?.caption_tracks || []) as CaptionTrack[];
  const track = selectEnglishTrack(tracks);
  if (!track) {
    throw new MaterialError(
      "YOUTUBE_CAPTIONS_REQUIRED",
      "This video does not expose English CC captions. Paste or upload a transcript to continue.",
    );
  }
  const mode: CaptionMode =
    track.kind === "asr" ? "automatic_caption" : "manual_caption";
  const units = await withRetry(
    "caption_fetch",
    () => fetchCaptionUnits(track, request),
    options.onAttempt,
  );
  // YouTube occasionally omits videoDetails.lengthSeconds even though the
  // video and its complete caption track are available. The final cue gives
  // us a bounded fallback without treating missing metadata as an over-limit
  // video.
  durationSeconds ||= captionDurationSeconds(units);
  if (!durationSeconds || durationSeconds > MAX_DURATION_SECONDS) {
    throw new MaterialError(
      "YOUTUBE_DURATION_EXCEEDED",
      "Only non-live YouTube videos up to 30 minutes are supported.",
    );
  }
  return {
    videoId,
    title: info.basic_info.title || `YouTube ${videoId}`,
    durationSeconds,
    mode,
    units,
  };
}

function parseDurationSeconds(value: unknown) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? Math.ceil(duration) : 0;
}

function captionDurationSeconds(units: SourceUnit[]) {
  const lastEndMs = units.reduce((latest, unit) => {
    const endMs = Number(
      "endMs" in unit.locator ? unit.locator.endMs : 0,
    );
    return Number.isFinite(endMs) ? Math.max(latest, endMs) : latest;
  }, 0);
  return Math.ceil(lastEndMs / 1000);
}

async function loadVideo(videoId: string, request: typeof fetch) {
  try {
    const youtube = await Innertube.create({
      lang: "en",
      location: "US",
      retrieve_player: false,
      generate_session_locally: true,
      fetch: request,
    });
    return await youtube.getBasicInfo(videoId, { client: "ANDROID" });
  } catch (error) {
    if (error instanceof RetryableRequestError) throw error;
    const detail =
      error instanceof Error ? error.message : "YouTube metadata failed.";
    if (/timeout|abort|429|rate|temporar|unavailable|blocked/i.test(detail)) {
      throw new RetryableRequestError(detail);
    }
    throw new MaterialError("YOUTUBE_VIDEO_UNAVAILABLE", detail);
  }
}

export function selectEnglishTrack(tracks: CaptionTrack[]) {
  const english = tracks.filter((track) =>
    /^en(?:-|$)/i.test(track.language_code),
  );
  return (
    english.find((track) => track.kind !== "asr") ||
    english.find((track) => track.kind === "asr")
  );
}

async function fetchCaptionUnits(track: CaptionTrack, request: typeof fetch) {
  let url: URL;
  try {
    url = new URL(track.base_url);
  } catch {
    throw new MaterialError(
      "YOUTUBE_CAPTION_INVALID",
      "YouTube returned an invalid caption URL.",
    );
  }
  url.searchParams.set("fmt", "json3");
  const response = await request(url);
  if (!response.ok) {
    throw new MaterialError(
      "YOUTUBE_ACCESS_BLOCKED",
      `YouTube caption download failed (${response.status}).`,
    );
  }
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_CAPTION_BYTES) {
    throw new MaterialError(
      "YOUTUBE_CAPTION_INVALID",
      "The YouTube caption track exceeds the 2 MiB limit.",
    );
  }

  let payload: {
    events?: Array<{
      tStartMs?: number;
      dDurationMs?: number;
      segs?: Array<{ utf8?: string }>;
    }>;
  };
  try {
    payload = JSON.parse(body);
  } catch {
    throw new MaterialError(
      "YOUTUBE_CAPTION_INVALID",
      "YouTube returned malformed caption data.",
    );
  }
  const units = (payload.events || [])
    .map((event) => {
      const startMs = Math.max(0, Math.round(Number(event.tStartMs || 0)));
      const duration = Math.max(
        1,
        Math.round(Number(event.dDurationMs || 1)),
      );
      const endMs = startMs + duration;
      const text = (event.segs || [])
        .map((segment) => segment.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      return {
        locator: {
          label: `${formatMs(startMs)}–${formatMs(endMs)}`,
          startMs,
          endMs,
        },
        text,
      } satisfies SourceUnit;
    })
    .filter((unit) => unit.text);
  if (!units.length || units.length > MAX_CUES) {
    throw new MaterialError(
      "YOUTUBE_CAPTION_INVALID",
      units.length
        ? "The YouTube caption track has too many cues."
        : "The YouTube caption track is empty.",
    );
  }
  const uniqueRatio =
    new Set(units.map((unit) => unit.text.toLowerCase())).size / units.length;
  if (units.length >= 50 && uniqueRatio < 0.1) {
    throw new MaterialError(
      "YOUTUBE_CAPTION_INVALID",
      "The YouTube caption track contains abnormal repetition.",
    );
  }
  return units;
}

function restrictedFetch(baseFetch: typeof fetch, deadline: number): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL
        ? input.toString()
        : input.url,
    );
    const host = url.hostname.toLowerCase();
    if (
      ![
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtubei.googleapis.com",
      ].includes(host)
    ) {
      throw new MaterialError(
        "YOUTUBE_ACCESS_BLOCKED",
        `Unexpected YouTube request host: ${host}`,
      );
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new RetryableRequestError("YouTube operation timed out.");
    }
    const timeout = AbortSignal.timeout(
      Math.min(REQUEST_TIMEOUT_MS, remaining),
    );
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    let response: Response;
    try {
      response = await baseFetch(input, { ...init, signal });
    } catch (error) {
      throw new RetryableRequestError(
        error instanceof Error ? error.message : "YouTube request failed.",
      );
    }
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new RetryableRequestError(
        `YouTube request failed (${response.status}).`,
        response.status,
        Number.isFinite(retryAfter)
          ? Math.min(10_000, retryAfter * 1000)
          : undefined,
      );
    }
    return response;
  };
}

async function withRetry<T>(
  operation: CaptionAttempt["operation"],
  call: () => Promise<T>,
  onAttempt?: Options["onAttempt"],
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const started = Date.now();
    try {
      const value = await call();
      await safeReport(onAttempt, {
        operation,
        attempt,
        retryReason: attempt > 1 ? "transient_provider_error" : undefined,
        durationMs: Date.now() - started,
        status: "success",
      });
      return value;
    } catch (error) {
      lastError = error;
      const retryable = error instanceof RetryableRequestError;
      const materialError = mapCaptionError(error);
      await safeReport(onAttempt, {
        operation,
        attempt,
        retryReason: attempt > 1 ? "transient_provider_error" : undefined,
        durationMs: Date.now() - started,
        status: retryable ? "provider_error" : "validation_error",
        errorCode: materialError.code,
        errorDetail: materialError.message,
      });
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) =>
        setTimeout(resolve, error.retryAfterMs ?? 1_000),
      );
    }
  }
  throw mapCaptionError(lastError);
}

function mapCaptionError(error: unknown) {
  if (error instanceof MaterialError) return error;
  return new MaterialError(
    "YOUTUBE_ACCESS_BLOCKED",
    error instanceof Error
      ? `YouTube could not be reached from this deployment: ${error.message}`
      : "YouTube could not be reached from this deployment.",
  );
}

async function safeReport(
  reporter: Options["onAttempt"],
  event: CaptionAttempt,
) {
  try {
    await reporter?.(event);
  } catch {
    // Usage telemetry must never block material processing.
  }
}
