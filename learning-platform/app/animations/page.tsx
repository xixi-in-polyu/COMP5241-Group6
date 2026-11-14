import { Clapperboard } from "lucide-react";

import {
  listExperimentAnimations,
  listPublishedVersions,
  listTopicAnimations,
} from "@/animation-studio/content/versions/registry";
import { PageShell } from "@/app/components/page-shell";
import { requirePageRoles } from "@/lib/auth/authorization";

import { AnimationCard } from "./animation-card";

export const instant = false;

export const metadata = {
  title: "Animation library | Learning Platform",
};

export default async function AnimationsPage() {
  const user = await requirePageRoles(["teacher", "student"]);
  const versions = listPublishedVersions();
  const topics = listTopicAnimations();
  const experiments = listExperimentAnimations();
  const homeHref = user.role === "teacher" ? "/teacher" : "/student";

  return (
    <PageShell homeHref={homeHref} user={user}>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#5d7892]">
          <Clapperboard aria-hidden="true" className="size-4" />
          Animation library
        </p>
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#193b61]">
          Watch an animation
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Compare the project as it moved from the original export to the
          current white-paper cut, or open a short topic introduction. Teachers
          can edit any animation; students watch read-only. Both roles can also
          inspect production experiments. Edits are not saved.
        </p>
      </div>

      <section aria-labelledby="version-history" className="mt-8">
        <h2
          className="text-xl font-bold tracking-[-0.01em] text-[#193b61]"
          id="version-history"
        >
          Version history
        </h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {versions.map((animation) => (
            <AnimationCard animation={animation} key={animation.id} />
          ))}
        </div>
      </section>

      <section aria-labelledby="topic-intros" className="mt-10">
        <h2
          className="text-xl font-bold tracking-[-0.01em] text-[#193b61]"
          id="topic-intros"
        >
          Topic intros
        </h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((animation) => (
            <AnimationCard animation={animation} key={animation.id} />
          ))}
        </div>
      </section>

      {experiments.length ? (
        <section aria-labelledby="iteration-experiments" className="mt-10">
          <h2
            className="text-xl font-bold tracking-[-0.01em] text-[#193b61]"
            id="iteration-experiments"
          >
            Iteration experiments
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Prototypes used to test diagrams, source-grounded visuals, recorded
            narration, and focused lesson structures before they became
            reusable production rules.
          </p>
          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {experiments.map((animation) => (
              <AnimationCard animation={animation} key={animation.id} />
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
