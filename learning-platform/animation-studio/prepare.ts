import { createSdlcProject } from "./data/sdlcProject";
import { migrateProject } from "./model/migrate";
import { projectValidator } from "./model/validator";
import type { AnimationProject } from "./model/types";

export type PreparedProject =
  | { project: AnimationProject; error: null }
  | { project: null; error: string };

/**
 * Migrates and validates the animation published to the platform.
 *
 * This runs in the browser (the studio is mounted with `ssr: false`) because
 * the model layer imports Remotion's math helpers, which cannot load in a
 * React Server Component. The build does not depend on it: `tests/animation-
 * publication.test.ts` validates the committed project before it ships.
 */
export function preparePublishedProject(input: unknown): PreparedProject {
  try {
    const project = migrateProject(input ?? createSdlcProject());
    const errors = projectValidator
      .validate(project)
      .filter((issue) => issue.severity === "error");

    if (errors.length > 0) {
      return {
        project: null,
        error: `Published animation is invalid: ${errors
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      };
    }

    return { project, error: null };
  } catch (error) {
    return {
      project: null,
      error:
        error instanceof Error
          ? error.message
          : "The published animation could not be loaded.",
    };
  }
}
