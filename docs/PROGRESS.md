# Progress

Current milestone: **M2 — Spike** (next)

| Milestone | Status |
|---|---|
| M0 Scaffold | Done |
| M1 Core logic | Done |
| M2 Spike | Not started |
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
