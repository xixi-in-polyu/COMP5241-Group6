"use client";

import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
};

export default function PdfViewer({
  fileUrl,
  currentPage,
  zoom,
  onLoadSuccess,
  onLoadError,
}: {
  fileUrl: string;
  currentPage: number;
  zoom: number;
  onLoadSuccess: (pdf: PdfDocument) => void;
  onLoadError: () => void;
}) {
  return (
    <Document
      file={fileUrl}
      onLoadSuccess={onLoadSuccess}
      onLoadError={onLoadError}
      loading={<p className="p-8 text-sm text-slate-500">Opening PDF...</p>}
    >
      <Page
        pageNumber={currentPage}
        width={Math.min(760, typeof window === "undefined" ? 760 : window.innerWidth - 80) * zoom}
        renderTextLayer
        renderAnnotationLayer
      />
    </Document>
  );
}
