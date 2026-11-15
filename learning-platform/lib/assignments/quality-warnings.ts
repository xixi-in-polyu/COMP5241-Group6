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
