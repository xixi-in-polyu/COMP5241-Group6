# Published animation

`published.animation.json` is the single animation published at `/animations`.
The route sends it to the Storyline Studio client, which migrates older schema
versions and validates it before rendering.

## Replacing the animation

1. In Storyline Studio, export the project as JSON (`Export project`).
2. Replace `published.animation.json` with that file.
3. Run `npm test` from `learning-platform`; the publication test validates the
   project before it ships.

The file contains the finished SDLC animation exported from Storyline Studio
(`schemaVersion: 3`). The studio migrates it to the current schema on load.

Do not reference files from the standalone studio's `public/` folder
(`/sdlc-teaching/...`, `/audio/...`). Those assets are not part of this
repository. If the published project needs imagery or audio, bundle the assets
into the project (Storyline Studio's portable asset embedding) or add them
explicitly under `learning-platform/public/`.
