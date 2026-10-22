import { head } from "@vercel/blob";
import type { Prisma } from "@prisma/client";

import { mapBlobMaterialError } from "@/lib/materials/blob-errors";
import { parseMaterial, validateMaterialMetadata } from "@/lib/materials/parsers";
import { segmentUnits } from "@/lib/materials/segment";
import { MaterialError } from "@/lib/materials/types";
import { prisma } from "@/lib/prisma";

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function courseMaterialParsingWorkflow(materialId: string) {
  "use workflow";
  await parseCourseMaterialStep(materialId);
}

async function parseCourseMaterialStep(materialId: string) {
  "use step";
  const material = await prisma.courseMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.kind !== "FILE" || !material.blobPathname) return;

  await prisma.courseMaterial.update({
    where: { id: materialId },
    data: { status: "PARSING", errorCode: null, errorDetail: null },
  });

  try {
    validateMaterialMetadata(material.name, material.mimeType, material.size);
    const blob = await head(material.blobPathname);
    const response = await fetch(blob.downloadUrl, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : undefined,
    });
    if (!response.ok) throw new MaterialError("BLOB_DOWNLOAD_FAILED", `Blob download failed (${response.status}).`);
    const parsed = await parseMaterial(new Uint8Array(await response.arrayBuffer()), material.name);
    const segments = segmentUnits(parsed.units);
    await prisma.$transaction([
      prisma.sourceSegment.deleteMany({ where: { materialId } }),
      prisma.sourceSegment.createMany({
        data: segments.map((segment) => ({
          courseId: material.courseId,
          materialId,
          ordinal: segment.ordinal,
          locator: json(segment.locator),
          rawText: segment.text,
          normalizedText: segment.text,
          hash: segment.hash,
        })),
      }),
      prisma.courseMaterial.update({
        where: { id: materialId },
        data: { status: "READY", pageCount: parsed.pageCount, errorCode: null, errorDetail: null },
      }),
    ]);
  } catch (error) {
    if (error instanceof MaterialError && error.code === "INSUFFICIENT_EXTRACTABLE_TEXT") {
      await prisma.courseMaterial.update({
        where: { id: materialId },
        data: { status: "DOWNLOAD_ONLY", aiSelected: false, errorCode: error.code, errorDetail: error.message },
      });
      return;
    }
    const failure = mapBlobMaterialError(error, "Parsing failed.");
    await prisma.courseMaterial.update({
      where: { id: materialId },
      data: { status: "FAILED", aiSelected: false, errorCode: failure.code, errorDetail: failure.message },
    });
  }
}
