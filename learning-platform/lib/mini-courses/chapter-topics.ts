type CourseLanguage = "en" | "zh";

function genericChapterTitle(index: number, language: CourseLanguage): string {
  return language === "zh" ? `第 ${index + 1} 章` : `Chapter ${index + 1}`;
}

export function requestedChapterTopics(input: {
  topics: string[];
  chapterCount: number;
  includeReview: boolean;
  language: CourseLanguage;
}): string[] {
  return [
    ...Array.from(
      { length: input.chapterCount },
      (_, index) => (input.topics[index] ?? "").trim(),
    ),
    ...(input.includeReview
      ? [input.language === "zh" ? "复习与延伸" : "Review & extension"]
      : []),
  ];
}

export function manualChapterTitles(
  topics: string[],
  language: CourseLanguage,
): string[] {
  return topics.map(
    (topic, index) => topic.trim() || genericChapterTitle(index, language),
  );
}

export function generatedChapterTitle(input: {
  requestedTopic: string;
  generatedTitle?: string;
  index: number;
  language: CourseLanguage;
}): string {
  return (
    input.requestedTopic.trim()
    || input.generatedTitle?.trim()
    || genericChapterTitle(input.index, input.language)
  );
}
