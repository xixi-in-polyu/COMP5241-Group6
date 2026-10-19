import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { parseMaterial, validateMaterialMetadata, validateSignature } from "@/lib/materials/parsers";
import { segmentUnits } from "@/lib/materials/segment";

const usefulText = "Human computer interaction studies how people understand and use interactive systems. Designers collect evidence, evaluate usability, and iterate interfaces to support real goals. ".repeat(3);

describe("material parsing", () => {
  it("validates supported metadata and signatures", () => {
    expect(() => validateMaterialMetadata("notes.txt", "text/plain", 100)).not.toThrow();
    expect(() => validateMaterialMetadata("image.png", "image/png", 100)).toThrow(/Only PDF/);
    expect(() => validateSignature(strToU8("not a pdf"), "pdf")).toThrow(/valid PDF/);
  });

  it("parses useful English text", async () => {
    const result = await parseMaterial(strToU8(usefulText), "notes.txt");
    expect(result.units[0].text).toContain("interactive systems");
  });

  it("rejects text with insufficient extractable English", async () => {
    await expect(parseMaterial(strToU8("图片文字"), "notes.txt")).rejects.toMatchObject({ code: "INSUFFICIENT_ENGLISH_TEXT" });
  });

  it("extracts DOCX paragraphs and PPTX slides", async () => {
    const docx = zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>${usefulText}</w:t></w:r></w:p></w:body></w:document>`) });
    const pptx = zipSync({ "ppt/slides/slide1.xml": strToU8(`<p:sld><a:t>${usefulText}</a:t></p:sld>`) });
    expect((await parseMaterial(docx, "lesson.docx")).units).toHaveLength(1);
    expect((await parseMaterial(pptx, "lesson.pptx")).units).toHaveLength(1);
  });

  it("segments long units with stable hashes", () => {
    const segments = segmentUnits([{ locator: { label: "Paragraph 1", paragraph: 1 }, text: usefulText.repeat(60) }]);
    expect(segments.length).toBeGreaterThan(1);
    expect(new Set(segments.map((item) => item.hash)).size).toBe(segments.length);
  });
});
