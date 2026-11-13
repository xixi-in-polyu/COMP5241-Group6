import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { PublishedAnimation } from "@/animation-studio/content/versions/registry";

export function AnimationCard({ animation }: { animation: PublishedAnimation }) {
  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#7791aa] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
      href={`/animations/${animation.id}`}
    >
      <div className="relative aspect-video overflow-hidden bg-slate-100">
        <Image
          alt={`${animation.label} preview`}
          className="object-cover"
          fill
          sizes="(min-width: 1280px) 380px, (min-width: 768px) 45vw, 90vw"
          src={`/animation-versions/${animation.id}.png`}
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[#193b61] px-2.5 py-1 text-xs font-semibold text-white">
            {animation.id.toUpperCase()}
          </span>
          {animation.latest ? (
            <span className="rounded-full bg-[#e9ff66] px-2.5 py-1 text-xs font-semibold text-[#1f2a10]">
              Latest
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-[-0.01em] text-[#193b61]">
          {animation.label}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {animation.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {animation.tags.map((tag) => (
            <span
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>
            {animation.scenes} scenes · {animation.durationLabel} ·{" "}
            {animation.images} illustration
            {animation.images === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1 font-semibold text-[#24496f]">
            Open
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
