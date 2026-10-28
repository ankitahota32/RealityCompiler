# Progress

Current milestone: **M3 — Server pipeline** (next)

| Milestone | Status |
|---|---|
| M0 Scaffold | Done |
| M1 Core logic | Done |
| M2 Spike | Done |
| M3 Server pipeline | Not started |
| M4 UI | Not started |
| M5 Exports and polish | Not started |
| M6 Eval and docs | Not started |
| M7 Accounts | Not requested |

## Log

### 2026-10-29 — M0 Scaffold (done)

Done:
- Moved the project documents into the layout CLAUDE.md expects: `SPEC.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/design.md`, `docs/nongoals.md`.
- Confirmed the git repo inside `RealityCompiler/` (branch `main`, remote `origin`).
- Next.js 16.4 (App Router, TypeScript strict, `src/`), Tailwind v4, ESLint, vitest, tsx. Stack dependencies installed and versions logged in DECISIONS.md.
- shadcn initialized (`components.json`, `src/lib/utils.ts`), no components yet. `motion` installed.
- `globals.css` holds the design.md tokens, shadcn variables mapped to them, `prefers-color-scheme` dark variant, drafting grid. System fonts only.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `spike`, `eval` (spike and eval files come in M2 and M6).
- `.env.example` (SPEC §15), `.gitignore` ignores `.env*` except `.env.example`.
- SPEC §4 folders created with `.gitkeep`. Stubs: `docs/SPIKE.md`, `docs/FINAL_REPORT.md`, `README.md`.

Checks: `typecheck`, `lint`, `test` (no tests yet) pass. `npm run dev` serves a blank page (HTTP 200) with the tokens in the CSS.

Failed and fixed:
- vitest 5 peer conflict with `@types/node@^20` → `@types/node@^22`.
- `typecheck` failed on the generated `LayoutProps` type → typed `children` explicitly.

Notes:
- The project lives in a OneDrive folder. Turbopack warns about frequent file updates while OneDrive syncs `node_modules`.

Next: M1 — core logic and core tests (SPEC §5, §6, §11, Appendices A to E). Starts with a plan.

### 2026-10-29 — M1 Core logic (done)

Done:
- Fixtures `bnpl.machine.json`, `bnpl.ai-gaps.json`, `bnpl.finalization.json` extracted verbatim from SPEC Appendices A, C, D.
- `src/core`: `types`, `validate`, `checker`, `questions`, `matrix`, `merge`, `patch`, `scenarios`, `mermaid`, `project`, `export/spec`, `export/gherkin`, `export/playwright`.
- 66 tests in 10 files under `tests/core` (all §14.1 core cases, plus matrix and merge). Export outputs were checked by hand against §11, then committed as inline snapshots.
- ESLint rule keeps `src/core` free of Next, React, Node built-ins and other layers.
- `.gitattributes` (LF), `vitest.config.mts`.

"Done when" check:
- The fixture yields exactly the 9 Appendix E.2 findings (ids, order, severities, state ids, kinds) and E.1 titles.
- After the Appendix D patch exactly the 7 E.3 findings remain. The matrix matches E.4.
- `typecheck`, `lint`, `test` pass.

Owner-approved contract additions: `ExportData.findings`, `f_nondeterministic_<stateId>_<eventId>`, `MatrixRow` shape (see DECISIONS.md).

Failed and fixed: Vite warned that `vitest.config.ts` was loaded as CommonJS → renamed to `.mts`.

Next: M2 — spike. Needs `GEMINI_API_KEY` in `.env.local` and, for V2, an owner-supplied `fixtures/spike-sketch.jpg`. Without a key, SPIKE.md records every item as `NOT TESTED – key missing` and work continues in mock mode.

### 2026-10-29 — M2 Spike (done)

Done:
- `scripts/spike.ts` checks V1 to V10 against the real API, paces calls under 14K tokens per minute, retries server errors, and writes `docs/SPIKE.md`. It never prints the key; all output is redacted.
- `src/server/gemma/declarations.ts` and `prompts.ts` generated word for word from SPEC.md.
- Result: **V1 to V10 all PASS**. Decisions in DECISIONS.md.

Findings that change the build:
- Analyze needs `maxOutputTokens` 8000 (SPEC says 4000): HIGH thinking used the whole 4000 and returned nothing. Gemma 4 only supports HIGH and MINIMAL.
- Forced function calls are accepted but make analyze and finalize worse, so they are not used.
- `gemma-4-31b-it` is slow and often returns 500/503; `gemma-4-26b-a4b-it` read the sketch and extracted correctly, faster. Model choice is left to the M6 eval.

Failed and fixed:
- The first run marked V3, V4 and V9 FAIL because of 500/503 server errors. The spike now retries longer, tries the other model, and records server-error-only checks as NOT TESTED.
- The owner's key was first placed in `.env.example`; caught before any commit and moved to `.env.local` by the owner.

Measured tokens (fixture, realistic input): extract about 2.0K, analyze about 6.0K (8000 cap), finalize about 2.4K. Time: extract 37 s (31b) or 21 s (26b), analyze 85 to 98 s, finalize 15 to 31 s.

Next: M3 — server pipeline (env, http, budget, Gemma client real and mock, packs, the three steps, API routes). Starts with a plan.
