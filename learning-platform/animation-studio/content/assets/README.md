# Illustration sources

These SVGs are the editable sources for the embedded illustrations in
`published.animation.json`. They use the project's 800 × 450 canvas, Morandi
palette, and the same ink/paper contrast as the scenes.

| File | Used by |
| --- | --- |
| `deploy-big-bang.svg` | scene 11, step 2 |
| `deploy-progressive.svg` | scene 11, step 3 (rolling + blue-green) |
| `deploy-canary.svg` | scene 11, step 4 |
| `secret-boundary.svg` | scene 6, step 4 |
| `architecture-ai-tutor.svg` | scene 5, steps 2–4 |
| `verification-validation.svg` | scene 8, steps 1–4 |
| `incident-timeline.svg` | scene 9, steps 1–4 |
| `availability-factors.svg` | scene 10, steps 3–4 |
| `harness-model-alone.svg` | Harness topic, scene 1 |
| `harness-layers.svg` | Harness topic, scene 2 |
| `harness-loop.svg` | Harness topic, scene 3 |
| `harness-compare.svg` | Harness topic, scene 4 |

The project embeds each SVG as a `data:image/svg+xml;base64,...` asset so the
JSON stays portable and deterministic. After editing an SVG, re-embed it:

```bash
cd learning-platform
node animation-studio/content/assets/embed-assets.mjs
```

The script rewrites the asset URI and SHA-256 in both
`content/published.animation.json` and `content/versions/published.animation-v5.json`.

Keep every illustration 16:9 and leave the bottom ~50 px free if a caption is
ever added back. Prefer labels inside the SVG over HTML captions: a caption
rendered by the studio becomes an opaque bar over the artwork.
