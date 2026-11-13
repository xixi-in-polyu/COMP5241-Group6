# Topic animations

`harness-intro.animation.json` is a four-scene, two-minute introduction to the
runtime around a model:

| Scene | Image | Steps |
| --- | --- | --- |
| A model is not an agent | `harness-model-alone.svg` | predictor → no tools → harness gives it a body |
| What the harness adds | `harness-layers.svg` | tools → context → boundaries |
| The loop | `harness-loop.svg` | observe/plan/act → results become context → stop condition |
| Harness in practice | `harness-compare.svg` | same model → DSH runtime → judge the harness |

Every scene is 30 seconds with three narration segments. The project uses the
current white-paper theme, a camera push/pan, image `move` cues, and
`ken-burns`. The SVG sources live in `../assets/harness-*.svg` and are embedded
as data URIs; after editing an SVG run:

```bash
cd learning-platform
node animation-studio/content/projects/embed-harness-assets.mjs
```

The gallery reads this project through `content/versions/registry.ts` as a
topic intro; the route is `/animations/harness`.
