import Link from "next/link";

const aiQuotaErrorPattern = /(?:\b429\b|ai\s+(?:(?:usage|hour|day)\s+)?limit reached|rate[_ -]?limit(?:ed| reached| exceeded)?|quota (?:reached|exceeded)|insufficient[_ ]quota|too many requests)/i;

export function isAiQuotaError(message: string): boolean {
  return aiQuotaErrorPattern.test(message);
}

export function AiSettingsLink({ message }: { message: string }) {
  if (!isAiQuotaError(message)) return null;
  return (
    <Link className="ml-2 font-semibold underline underline-offset-2" href="/ai-settings">
      设置自己的 API
    </Link>
  );
}
