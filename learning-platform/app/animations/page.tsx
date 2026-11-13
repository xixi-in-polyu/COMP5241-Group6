import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clapperboard } from "lucide-react";

import { listPublishedVersions } from "@/animation-studio/content/versions/registry";
import { PageShell } from "@/app/components/page-shell";
import { requirePageRoles } from "@/lib/auth/authorization";

export const instant = false;

export const metadata = {
  title: "Animation versions | Learning Platform",
};

export default async function AnimationsPage() {
  const user = await requirePageRoles(["teacher", "student"]);
  const versions = listPublishedVersions();
  const homeHref = user.role === "teacher" ? "/teacher" : "/student";

  return (
    <PageShell homeHref={homeHref} user={user}>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#5d7892]">
          <Clapperboard aria-hidden="true" className="size-4" />
          Animation archive
        </p>
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#193b61]">
          All animation versions
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Compare the project as it moved from the original export to the
          current white-paper cut. Teachers can open any version and edit it;
          students watch the same versions read-only. Edits are not saved.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {versions.map((version) => (
          <Link
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#7791aa] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            href={`/animations/${version.id}`}
            key={version.id}
          >
            <div className="relative aspect-video overflow-hidden bg-slate-100">
              <Image
                alt={`${version.label} preview`}
                className="object-cover"
                fill
                sizes="(min-width: 1280px) 380px, (min-width: 768px) 45vw, 90vw"
                src={`/animation-versions/${version.id}.png`}
              />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#193b61] px-2.5 py-1 text-xs font-semibold text-white">
                  {version.id.toUpperCase()}
                </span>
                {version.latest ? (
                  <span className="rounded-full bg-[#e9ff66] px-2.5 py-1 text-xs font-semibold text-[#1f2a10]">
                    Latest
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-lg font-semibold tracking-[-0.01em] text-[#193b61]">
                {version.label}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {version.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {version.tags.map((tag) => (
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
                  {version.scenes} scenes · {version.durationLabel} ·{" "}
                  {version.images} illustration{version.images === 1 ? "" : "s"}
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
        ))}
      </div>
    </PageShell>
  );
}
