# AI_PROMPT_TEMPLATE.md

Use this prompt when handing the repo to another AI:

---

You are upgrading Whale (Palestine marketplace) in this repository.

Read these files first and follow them strictly:
1. `README.md`
2. `AI_HANDOFF.md`
3. `AGENTS.md`

Rules:
- Keep business logic in `services/`.
- Keep routes thin (`routes/`).
- Keep CSRF and auth guards intact.
- Keep bilingual Arabic+English text.
- Keep `dir="auto"` for user content.
- Preserve the trust promise:
  "أموالك محفوظة حتى تؤكد الاستلام — Your money is protected until you confirm delivery."

Execution requirements:
- Implement changes end-to-end, not just planning.
- After edits run at least:
  - `npm run test`
  - `npx playwright test __uitests__/pages/whale-marketplace.spec.js`
- For final verification run:
  - `npm run test:coverage`
  - `npm run test:ui`
- Report exact pass/fail output and changed files.

Current product mode:
- Whale-first app (`/whale` is primary).
- Legacy paths redirect to `/whale`.

Task to perform:
<PASTE YOUR TASK HERE>

---
