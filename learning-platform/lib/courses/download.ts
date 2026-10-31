import "server-only";

import { head } from "@vercel/blob";

import { ApiError } from "@/lib/api";
import { safeDownloadName } from "./security";

export async function materialDownloadResponse(
  material: {
    kind: "FILE" | "TEXT";
    name: string;
    mimeType: string;
    blobPathname: string | null;
    textContent: string | null;
  },
  options: { disposition?: "attachment" | "inline" } = {},
) {
  const filename = safeDownloadName(material.name);
  const disposition = options.disposition === "inline" ? "inline" : "attachment";
  if (material.kind === "TEXT") {
    return new Response(material.textContent ?? "", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (!material.blobPathname) throw new ApiError(404, "Material file is unavailable.");
  const blob = await head(material.blobPathname);
  const upstream = await fetch(blob.downloadUrl, {
    headers: process.env.BLOB_READ_WRITE_TOKEN
      ? { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      : undefined,
  });
  if (!upstream.ok || !upstream.body) throw new ApiError(502, "Could not download the material.");
  return new Response(upstream.body, {
    headers: {
      "content-type": blob.contentType || material.mimeType || "application/octet-stream",
      "content-length": String(blob.size),
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
