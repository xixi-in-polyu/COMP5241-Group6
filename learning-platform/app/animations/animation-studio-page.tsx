"use client";

import dynamic from "next/dynamic";

const Studio = dynamic(() => import("@/animation-studio/App"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        alignItems: "center",
        color: "#64707c",
        display: "flex",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        height: "100%",
        justifyContent: "center",
        background: "#eef1f4",
        letterSpacing: "0.08em",
      }}
    >
      Loading animation…
    </div>
  ),
});

export function AnimationStudioPage({
  project,
  readOnly,
  exitHref,
  versionLabel,
}: {
  project: unknown;
  readOnly: boolean;
  exitHref: string;
  versionLabel?: string;
}) {
  return (
    <div className="animation-studio">
      <Studio
        exitHref={exitHref}
        initialProject={project}
        readOnly={readOnly}
        versionLabel={versionLabel}
      />
    </div>
  );
}
