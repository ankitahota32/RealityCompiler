# Progress

Current milestone: **M1 — Core logic** (next)

| Milestone | Status |
|---|---|
| M0 Scaffold | Done |
| M1 Core logic | Not started |
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
