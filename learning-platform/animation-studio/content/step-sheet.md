# Step sheet — From Idea to Impact

This is the authored step layer for the published animation. It follows
`animation/skills/animation-production/references/step-sheet.md`: every 66.5 s
scene has four steps, and every step adds a new visual fact rather than only
pulsing an existing one.

Times are scene-local. Narration segments start at 0.0, 16.2, 32.5, and 48.8 s;
the final step holds from 65.0 to the 66.5 s transition.

| Scene | Step 1 (0–16 s) | Step 2 (16–32 s) | Step 3 (33–49 s) | Step 4 (49–65 s) |
| --- | --- | --- | --- | --- |
| 1. A product is a living system | title, badge, lifecycle **NEW** | `The lifecycle gives the journey structure` **ANNOTATE** | AI tutor cards: students / teachers / team **NEW** | `Feedback becomes the next requirement` **NEW** |
| 2. One loop, many decisions | title, thesis, delivery loop **NEW** | `Requirements → Design → Implementation` **ANNOTATE** | `Test at every level` — inside-out / outside-in **CONTRAST** | `Deploy, then maintain` **ANNOTATE** |
| 3. Start with the problem | title, `People · workflows · value` **NEW** | functional vs non-functional comparison **CONTRAST** | NFR badge: performance / reliability / security **ANNOTATE** | elicitation methods cards **NEW** |
| 4. Prototype to learn | title, learning loop **NEW** | `Throwaway · Evolutionary · Incremental` **NEW** | fidelity cards: wireframe / mockup / high-fidelity **NEW** | `MVP: enough value to test the business idea` **ANNOTATE** |
| 5. Turn “what” into “how” | title, design thesis **NEW** | AI tutor architecture topology **NEW** | `React → Flask API → AI service → database` **ANNOTATE** | scale / failure / security / trade-offs **NEW** |
| 6. Secrets stop at the boundary | title, secret path **NEW** | local `.env` + `.gitignore` cards **NEW** | `Production injects secrets at runtime` **ANNOTATE** | browser never receives the key **NEW** |
| 7. Test the seams | title, confidence flow **NEW** | `Contracts · data · timing · errors` **ANNOTATE** | different tests / different risks cards **NEW** | acceptance: alpha and beta **NEW** |
| 8. Right product. Built right. | title, verification vs validation **CONTRAST** | `Code review · unit · integration · system` **ANNOTATE** | confirmation / regression cards **NEW** | `Feedback creates the next requirement` **NEW** |
| 9. Production changes the rules | title, incident timeline, thesis **NEW** | `03:00 — latency climbs, no alert` **ANNOTATE** | `Missing index → rewrite → staging patch` **NEW** | `Seven hours of invisible impact` **NEW** |
| 10. Reliability is measurable | title, availability formula **NEW** | operational metrics: TTD / TTM / TTR **NEW** | availability factors **NEW** | four kinds of maintenance **NEW** |
| 11. Choose your risk envelope | title, four release strategies **NEW** | `Big bang: widest blast radius` **ANNOTATE** | `Rolling · blue-green · canary: smaller radius` **ANNOTATE** | `Risk envelope = blast radius × rollback speed` **NEW** |
| 12. Ship, observe, learn | title, continuous delivery flow **NEW** | `Deploy vs release` comparison **CONTRAST** | production signals: uptime / latency / errors **NEW** | `The lifecycle never really ends` **NEW** |

## Motion notes

- Titles have no beats. Step elements get one emphasis beat at most.
- Flow, timeline, and topology elements use `trace` while narration names their
  parts; cards and comparisons use `lift`; metrics use `count-up`.
- Step 2 and step 3 callouts fade out before the next callout enters. Step 4
  callouts stay on screen through the 1.5 s quiet hold.
- No element moves or changes layout inside a step. Those moves are recorded as
  schema gaps in the skill, not faked with pulses.

## Schema gaps

The reference explainer this was compared against moves objects and pushes the
camera inside a scene. The current model cannot express either. The step sheet
uses new elements, lanes, focus beats, and exits instead. A future schema could
add `move`, `spotlight`, and camera cues, which would allow the same four steps
with fewer elements.
