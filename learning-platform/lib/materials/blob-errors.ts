import { BlobNotFoundError } from "@vercel/blob";

import { MaterialError } from "@/lib/materials/types";

export function mapBlobMaterialError(error: unknown, fallbackMessage: string) {
  if (error instanceof MaterialError) return error;
  if (error instanceof BlobNotFoundError) {
    return new MaterialError(
      "BLOB_NOT_FOUND",
      "The uploaded file is no longer available in Blob storage. Replace the file to continue.",
    );
  }
  if (
    error instanceof Error &&
    error.message.includes("OIDC is enabled for this project") &&
    error.message.includes("environment")
  ) {
    return new MaterialError(
      "BLOB_ACCESS_DENIED",
      "The Blob store does not allow this environment. Check the project Blob credentials and retry.",
    );
  }
  return new MaterialError(
    "MATERIAL_PARSE_FAILED",
    error instanceof Error ? error.message : fallbackMessage,
  );
}
