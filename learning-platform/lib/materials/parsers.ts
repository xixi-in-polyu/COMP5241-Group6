import { unzipSync, strFromU8 } from "fflate";
import iconv from "iconv-lite";
import { MaterialError, type ParsedMaterial, type SourceUnit } from "./types";

const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
};
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function extensionOf(name: string) { return name.toLowerCase().split(".").pop() || ""; }

export function validateMaterialMetadata(name: string, mimeType: string, size: number) {
  const extension = extensionOf(name);
  if (!Object.hasOwn(MIME_BY_EXTENSION, extension)) throw new MaterialError("UNSUPPORTED_FILE_TYPE", "Only PDF, TXT, DOCX, and PPTX files are supported.");
  if (size <= 0 || size > MAX_FILE_BYTES) throw new MaterialError("FILE_SIZE_EXCEEDED", "Each file must be no larger than 20 MiB.");
  if (mimeType && !MIME_BY_EXTENSION[extension].includes(mimeType)) throw new MaterialError("MIME_MISMATCH", `The MIME type does not match .${extension}.`);
}

export function validateSignature(buffer: Uint8Array, extension: string) {
  const first = Array.from(buffer.slice(0, 8));
  if (extension === "pdf" && String.fromCharCode(...first.slice(0, 5)) !== "%PDF-") throw new MaterialError("FILE_SIGNATURE_MISMATCH", "The file is not a valid PDF.");
  if (["docx", "pptx"].includes(extension) && !(first[0] === 0x50 && first[1] === 0x4b)) throw new MaterialError("FILE_SIGNATURE_MISMATCH", "The Office file is not a valid ZIP package.");
}

function xmlText(xml: string, tag: "w:t" | "a:t") {
  return Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g")))
    .map((match) => match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim())
    .filter(Boolean).join(" ");
}

function decodeText(buffer: Uint8Array) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return iconv.decode(Buffer.from(buffer.slice(2)), "utf16-le");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return iconv.decode(Buffer.from(buffer.slice(2)), "utf16-be");
  return iconv.decode(Buffer.from(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.slice(3) : buffer), "utf8");
}

function assertUsefulEnglish(units: SourceUnit[]) {
  const text = units.map((unit) => unit.text).join(" ");
  const latinWords = text.match(/[A-Za-z]{2,}/g)?.length ?? 0;
  if (text.trim().length < 120 || latinWords < 20) throw new MaterialError("INSUFFICIENT_ENGLISH_TEXT", "The document does not contain enough machine-readable English text.");
}

async function parsePdf(buffer: Uint8Array): Promise<ParsedMaterial> {
  if (/\/Encrypt\b/.test(Buffer.from(buffer).toString("latin1"))) throw new MaterialError("ENCRYPTED_FILE", "Encrypted PDFs are not supported.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: buffer, useWorkerFetch: false, useSystemFonts: true }).promise;
  if (document.numPages > 100) throw new MaterialError("PAGE_LIMIT_EXCEEDED", "PDF exceeds 100 pages.");
  const units: SourceUnit[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    if (text) units.push({ locator: { label: `Page ${pageNumber}`, page: pageNumber }, text });
  }
  assertUsefulEnglish(units);
  return { units, pageCount: document.numPages };
}

function parseDocx(buffer: Uint8Array): ParsedMaterial {
  const files = unzipSync(buffer);
  const document = files["word/document.xml"];
  if (!document) throw new MaterialError("OFFICE_PACKAGE_INVALID", "DOCX is missing word/document.xml.");
  const paragraphs = Array.from(strFromU8(document).matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g));
  const units = paragraphs.map((match, index) => ({ locator: { label: `Paragraph ${index + 1}`, paragraph: index + 1 }, text: xmlText(match[1], "w:t") })).filter((unit) => unit.text);
  assertUsefulEnglish(units);
  return { units, pageCount: Math.max(1, Math.ceil(units.reduce((sum, unit) => sum + unit.text.length, 0) / 3_000)) };
}

function parsePptx(buffer: Uint8Array): ParsedMaterial {
  const files = unzipSync(buffer);
  const names = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  if (names.length > 100) throw new MaterialError("PAGE_LIMIT_EXCEEDED", "Presentation exceeds 100 slides.");
  const units = names.map((name, index) => ({ locator: { label: `Slide ${index + 1}`, slide: index + 1 }, text: xmlText(strFromU8(files[name]), "a:t") })).filter((unit) => unit.text);
  assertUsefulEnglish(units);
  return { units, pageCount: names.length };
}

function parsePlainText(buffer: Uint8Array): ParsedMaterial {
  const text = decodeText(buffer).replace(/\r/g, "").trim();
  const units = text.split(/\n\s*\n/).map((value, index) => ({ locator: { label: `Paragraph ${index + 1}`, paragraph: index + 1 }, text: value.trim() })).filter((unit) => unit.text);
  assertUsefulEnglish(units);
  return { units, pageCount: Math.max(1, Math.ceil(text.length / 3_000)) };
}

export async function parseMaterial(buffer: Uint8Array, name: string): Promise<ParsedMaterial> {
  const extension = extensionOf(name);
  validateSignature(buffer, extension);
  if (extension === "pdf") return parsePdf(buffer);
  if (extension === "docx") return parseDocx(buffer);
  if (extension === "pptx") return parsePptx(buffer);
  if (extension === "txt") return parsePlainText(buffer);
  throw new MaterialError("UNSUPPORTED_FILE_TYPE", "Unsupported material type.");
}
