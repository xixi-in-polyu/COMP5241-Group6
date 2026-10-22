"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { BLOCK_TYPE_LABELS } from "@/lib/mini-courses/labels";
import type { MiniCourseBlock, BlockType } from "@/lib/mini-courses/types";

const ADDABLE: BlockType[] = ["text", "heading", "summary", "activity"];

function newBlock(type: BlockType): MiniCourseBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading":
      return { id, type, text: "" };
    case "summary":
      return { id, type, text: "" };
    case "activity":
      return {
        id,
        type,
        instruction: "",
        items: [
          { id: crypto.randomUUID(), text: "" },
          { id: crypto.randomUUID(), text: "" },
        ],
      };
    default:
      return { id, type: "text", text: "" };
  }
}

/** Edits the ordered blocks of a single chapter. */
export function BlockListEditor({
  blocks,
  onChange,
}: {
  blocks: MiniCourseBlock[];
  onChange: (next: MiniCourseBlock[]) => void;
}) {
  function update(index: number, block: MiniCourseBlock) {
    onChange(blocks.map((item, itemIndex) => (itemIndex === index ? block : item)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) {
      return;
    }
    const next = blocks.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-[#e2e8f0] bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#eef2f6] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#5b6b7d]">
              {BLOCK_TYPE_LABELS[block.type]}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move block up"
                className="focus-ring grid size-8 place-items-center rounded-lg text-[#8a99a9] hover:bg-[#eef2f6] disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === blocks.length - 1}
                aria-label="Move block down"
                className="focus-ring grid size-8 place-items-center rounded-lg text-[#8a99a9] hover:bg-[#eef2f6] disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))}
                aria-label="Delete block"
                className="focus-ring grid size-8 place-items-center rounded-lg text-[#8a99a9] hover:bg-[#fbeaea] hover:text-[#8c1d24]"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {block.type === "activity" ? (
            <div className="space-y-2">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={block.instruction}
                onChange={(event) => update(index, { ...block, instruction: event.target.value })}
                placeholder="Instruction for the learner"
                aria-label="Activity instruction"
              />
              <ul className="space-y-1.5">
                {block.items.map((item, itemIndex) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-xs text-[#8a99a9]">{itemIndex + 1}.</span>
                    <input
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      value={item.text}
                      onChange={(event) =>
                        update(index, {
                          ...block,
                          items: block.items.map((candidate) =>
                            candidate.id === item.id
                              ? { ...candidate, text: event.target.value }
                              : candidate,
                          ),
                        })
                      }
                      aria-label={`Item ${itemIndex + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(index, {
                          ...block,
                          items: block.items.filter((candidate) => candidate.id !== item.id),
                        })
                      }
                      disabled={block.items.length === 1}
                      aria-label={`Remove item ${itemIndex + 1}`}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-[#8a99a9] hover:bg-[#fbeaea] disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  update(index, {
                    ...block,
                    items: [...block.items, { id: crypto.randomUUID(), text: "" }],
                  })
                }
                className="text-xs font-semibold text-[#24496f] hover:underline"
              >
                Add item
              </button>
            </div>
          ) : block.type === "heading" || block.type === "text" || block.type === "summary" ? (
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6"
              rows={block.type === "heading" ? 1 : 5}
              value={block.text}
              onChange={(event) => update(index, { ...block, text: event.target.value })}
              placeholder={block.type === "heading" ? "Section heading" : "Write the section…"}
              aria-label={`${BLOCK_TYPE_LABELS[block.type]} content`}
            />
          ) : (
            <p className="rounded-lg bg-[#f5f8fb] px-3 py-2 text-xs text-[#6a7c90]">
              This block holds an attachment. Editing attachments is not wired up yet.
            </p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        {ADDABLE.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange([...blocks, newBlock(type)])}
            className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#c6d2df] bg-white px-2.5 text-xs font-semibold text-[#193b61] hover:border-[#9fb2c6] hover:bg-[#f7f9fb]"
          >
            <Plus className="size-3" aria-hidden="true" />
            {BLOCK_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
