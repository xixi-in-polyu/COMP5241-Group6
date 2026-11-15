const noIssuesFoundPattern = /(?:^|\s)no issues found\.?$/i;

export function isNoIssuesFoundWarning(value: unknown): boolean {
  return typeof value === "string" && noIssuesFoundPattern.test(value.trim());
}

export function visibleQualityWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (warning): warning is string =>
      typeof warning === "string"
      && warning.trim().length > 0
      && !isNoIssuesFoundWarning(warning),
  );
}

const questionWarningPattern = /^([0-9a-f-]{36}):\s*(.*)$/i;

export function formatQualityWarning(warning: string, questionIds: string[]): string {
  const match = questionWarningPattern.exec(warning.trim());
  if (!match) return warning;
  const questionIndex = questionIds.indexOf(match[1]);
  const label = questionIndex >= 0 ? `Question ${questionIndex + 1}` : "Question";
  return `${label}: ${match[2]}`;
}
