<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


<!-- UI-Agent-rules -->

## UI/UX Design Constraints (Strictly Follow)
When generating UI components with Tailwind CSS, act as a senior design lead. Avoid these common AI-generated templates:
1. **No Generic Defaults**: Avoid default purple/blue gradients, cream backgrounds with terracotta accents, or identical rounded cards with the same soft shadow everywhere.
2. **Typography**: Do NOT use ALL-CAPS for labels. Do NOT accent a single word in a headline with italic/bold. Do NOT add unnecessary eyebrows (tiny text above headings).
3. **Structure**: Do NOT use numbered markers (01 / 02 / 03) unless the content is a real sequence. Use visual structure (borders, spacing) only to convey information, not just for decoration.
4. **Motion**: Avoid generic fade-and-slide-up animations on every section. Keep motion deliberate and only for user-triggered interactions or a single orchestrated page-load moment.
5. **Copywriting**: Use active voice for buttons ("Save changes" not "Submit"). Keep tone conversational and plain. Name things by what users understand, not system terms.
