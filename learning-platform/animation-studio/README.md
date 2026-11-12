# Storyline Studio (vendored)

This folder is the runtime part of the standalone Storyline Studio prototype,
copied from the `animation/` repository at commit `8634d77` so the Learning
Platform can host it without a second deployment.

## What was copied

- `App.tsx`, `components/`, `hooks/`, `model/`, `data/`, and `styles.css`.
- Upstream `main.tsx`, the Remotion CLI entry (`remotion/`), and the studio's
  test files were left out: the platform owns the entry point, the Remotion
  Player is rendered directly, and tests live in `learning-platform/tests/`.

## Platform adaptations

- `App.tsx` is a client component loaded with `ssr: false`; it accepts
  `initialProject`, `readOnly`, and `exitHref`. Students get a read-only preview;
  teachers keep the editor. `prepare.ts` migrates and validates the published
  JSON in the browser because the model layer imports Remotion.
- `styles.css` is scoped to `.animation-studio` so its global `body`/element
  rules cannot leak into the rest of the platform. Remote Google Fonts were
  replaced with the platform font stack (`Avenir Next`/`Segoe UI` and the
  system monospace).
- The studio no longer creates its own React root; `app/animations/` mounts it
  with `ssr: false` because it uses `localStorage`, `speechSynthesis`, and the
  Remotion Player at runtime.

## Boundaries

The studio has no persistence, AI generation, server TTS, or MP4 export. The
published project lives in `content/published.animation.json`; editing in the
browser is temporary and can be exported as JSON. See the upstream `TODO.md`
for the API work that is intentionally out of scope here.
