import type { MiniCourseBlock } from "@/lib/mini-courses/types";

/**
 * Reader-facing rendering of one content block.
 *
 * Uploads are not wired up yet, so image, video and file blocks render a
 * neutral placeholder instead of a broken element. Everything else is real.
 */
export function BlockView({ block }: { block: MiniCourseBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="mt-6 text-base font-semibold text-[#142f4d]">{block.text}</h3>;

    case "text":
      return <p className="mt-3 text-sm leading-7 text-[#3f5568]">{block.text}</p>;

    case "summary":
      return (
        <div className="mt-4 rounded-xl border-l-4 border-[#193b61] bg-[#f2f6fb] px-4 py-3 text-sm leading-6 text-[#24496f]">
          {block.text}
        </div>
      );

    case "activity":
      return (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-[#142f4d]">{block.instruction}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#53657a]">
            {block.items.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ol>
        </div>
      );

    case "image":
      return <MediaPlaceholder kind="Image" title={block.caption || "Untitled image"} />;

    case "video":
      return <MediaPlaceholder kind="Video" title={block.title || "Untitled video"} />;

    case "file":
      return <MediaPlaceholder kind="File" title={block.title || "Untitled file"} />;
  }
}

function MediaPlaceholder({ kind, title }: { kind: string; title: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-[#fbfcfe] px-4 py-5 text-sm text-[#6a7c90]">
      <p className="font-medium text-[#425468]">{title}</p>
      <p className="mt-1 text-xs">{kind} attachments are not connected yet.</p>
    </div>
  );
}
