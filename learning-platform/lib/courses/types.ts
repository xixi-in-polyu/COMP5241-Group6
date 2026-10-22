export type CoursePublicationStatus = "draft" | "published";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type LearnerBackground = "beginner" | "experienced";
export type CourseLanguage = "en" | "zh";
export type CourseResourceKind = "link" | "video" | "file";
export type CourseMaterialStatus =
  | "uploading"
  | "uploaded"
  | "parsing"
  | "ready"
  | "download_only"
  | "failed";

export interface CourseResource {
  id: string;
  kind: CourseResourceKind;
  title: string;
  url: string;
}

export interface CourseMaterial {
  id: string;
  chapterId: string | null;
  kind: "file" | "text";
  name: string;
  mimeType: string;
  size: number;
  status: CourseMaterialStatus;
  aiSelected: boolean;
  pageCount: number | null;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: string;
}

export type CourseBlock =
  | { id: string; type: "heading" | "text" | "summary"; text: string }
  | { id: string; type: "image"; url: string; caption: string }
  | { id: string; type: "video"; url: string; title: string }
  | { id: string; type: "file"; url: string; title: string; description: string }
  | {
      id: string;
      type: "activity";
      instruction: string;
      items: { id: string; text: string }[];
    };

export interface CourseChapter {
  id: string;
  title: string;
  objectives: string[];
  resources: CourseResource[];
  materials: CourseMaterial[];
  blocks: CourseBlock[];
}

export interface UnifiedCourse {
  id: string;
  title: string;
  description: string;
  subject: string;
  audience: string;
  objectives: string[];
  level: CourseLevel;
  background: LearnerBackground;
  durationMinutes: number;
  language: CourseLanguage;
  publicationStatus: CoursePublicationStatus;
  knowledgeStatus: string;
  knowledgeStale: boolean;
  archivedAt: string | null;
  ownerId: string;
  ownerRole: "teacher" | "student";
  createdAt: string;
  updatedAt: string;
  resources: CourseResource[];
  materials: CourseMaterial[];
  chapters: CourseChapter[];
  assignmentCount: number;
}
