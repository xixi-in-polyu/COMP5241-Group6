/** Truncate sources sequentially so earlier author-selected sources win. */
export function truncateCourseSources(
  sources: { label: string; text: string }[],
  perSource = 6_000,
  total = 18_000,
) {
  let budget = total;
  return sources.map((source) => {
    const text = source.text.slice(0, Math.max(0, Math.min(perSource, budget)));
    budget -= text.length;
    return { label: source.label, text };
  });
}
