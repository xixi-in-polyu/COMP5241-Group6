# Version history

| Version | File | What changed |
| --- | --- | --- |
| v2 | `published.animation-v2.json` | The original Storyline Studio export (`schemaVersion: 3`): 12 scenes × 65 s, three elements per scene, one entrance followed by pulses. |
| v3 | `published.animation-v3.json` | Step layer: migrated to schema 5, four steps per scene, 63 elements, step callouts, a reduced pulse budget, and a 1.5 s quiet hold. |
| v4 | `published.animation-v4.json` | Visual layer: four embedded SVG illustrations (big bang, progressive release, canary, secret boundary), image scenes for 6 and 11, and `ken-burns` ambient motion. |

`published.animation.json` is a copy of the latest version (v4). The route loads
that file. Keep older versions when changing the visual language so a visual
regression can be compared, not just re-described.

The original source export also exists outside this repository; these copies are
the platform's record of what was published.
