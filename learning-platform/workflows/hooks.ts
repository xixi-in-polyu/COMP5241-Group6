import { defineHook } from "workflow";
import { z } from "zod";

export const assignmentMaterialReadyHook = defineHook({
  schema: z.object({
    reason: z.enum([
      "captions-retry",
      "document-retry",
      "material-replaced",
      "material-removed",
      "transcript-added",
    ]),
  }),
});

export const assignmentEntityReviewHook = defineHook({
  schema: z.object({ revision: z.number().int().nonnegative() }),
});
