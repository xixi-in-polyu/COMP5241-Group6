// Browser-side PDF text extraction for the reader chat. The extracted text is
// sent to /api/chat as context so the assistant can ground answers in the file
// the student is currently reading and cite page numbers.

export type PdfPage = { page: number; text: string };

const MAX_TEXT_CHARS = 60_000;
const extractionCache = new Map<string, Promise<PdfPage[]>>();

export async function extractPdfPages(url: string): Promise<PdfPage[]> {
  const cached = extractionCache.get(url);
  if (cached) return cached;

  const pending = readPdf(url).catch((error: unknown) => {
    // Do not cache failures; a later attempt may succeed.
    extractionCache.delete(url);
    throw error;
  });
  extractionCache.set(url, pending);
  return pending;
}

async function readPdf(url: string): Promise<PdfPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download the PDF (${response.status}).`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  try {
    const pages: PdfPage[] = [];
    let length = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) {
          pages.push({ page: pageNumber, text });
          length += text.length + 2;
        }
      } finally {
        page.cleanup();
      }
      if (length >= MAX_TEXT_CHARS) break;
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
