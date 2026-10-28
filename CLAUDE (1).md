# RealityCompiler: instructions for Claude Code

RealityCompiler is a plan checker for software ideas. A user shows a plan (sketch photo, screenshot, or typed text). The app turns it into a state machine with Gemma 4, checks it with deterministic code, asks the user about each gap, and exports a specification. It is one Next.js app (App Router, TypeScript strict) that calls the Gemini API from route handlers.

Core idea to protect: **the model proposes, code verifies.** Structural checks are plain code, never prompts.

## Documents, and which one wins

When two documents disagree, the lower number wins.

1. `SPEC.md`: source of truth for behavior, contracts, exact strings and milestones.
2. `CLAUDE.md` (this file): how to work in this repo.
3. `docs/architecture.md`: how the code is organised. It summarizes SPEC and adds no rules.
4. `docs/nongoals.md`: what must not be built.
5. `docs/design.md`: how the UI looks and moves. It never changes behavior, strings or contracts.

`SPEC.md` is long. Do not read it top to bottom every session. Read only what the task needs:

| Task | Read |
|---|---|
| Types, zod schemas, ids | SPEC §5 |
| Checker, questions, matrix, sorting | SPEC §6, Appendix E |
| Gemma client, prompts, steps, patch | SPEC §7, §12, §17 |
| API routes and error codes | SPEC §9 |
| UI behavior and exact strings | SPEC §10 and `docs/design.md` |
| Exports, Mermaid, project file | SPEC §11 |
| Security and privacy | SPEC §13 |
| Tests and acceptance | SPEC §14 |
| Env vars | SPEC §15 |
| Milestones and "Done when" | SPEC §16 |
| Fixtures | SPEC Appendices A to F |
| Accounts (only if the owner asked) | SPEC §19, Appendix H |

## Commands

```
npm run dev          # local app on http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # vitest run
npm run build
npm run spike        # M2: checks every [VERIFY] item, writes docs/SPIKE.md
npm run eval         # M6: needs GEMINI_API_KEY, refuses MOCK_GEMMA=1
```

`MOCK_GEMMA=1` runs everything offline from fixtures. The Demo button must always work, with or without a key.

## How to work (every session)

1. Read `docs/PROGRESS.md` to see the current milestone. Create it at M0 if missing.
2. Work on ONE milestone at a time, in the order of SPEC §16. Do not start milestone N+1 until the "Done when" of N passes.
3. Start each milestone in plan mode: list the files you will create or change and the tests you will write. Wait for approval, then build.
4. For `src/core`, write the tests first or alongside the code. Core logic is pure and must be exactly right.
5. At the end of a milestone run `npm run typecheck && npm run lint && npm test`. Fix every failure.
6. Append what you did, what failed and what is next to `docs/PROGRESS.md`, then make a git commit named `M<n>: <summary>`.
7. If something matters and SPEC does not say, choose the simplest option and log it in `docs/DECISIONS.md` (date, question, choice, reason). Do not guess silently. Only stop to ask the owner for a missing credential (the Gemini API key) or a conflict you cannot resolve with the document order above.

## Hard rules (summary of SPEC §0)

- Implement exactly what SPEC says. Do not add features that are not in SPEC §2.1.
- Never invent API behavior. Anything marked **[VERIFY]** is tested in the M2 spike before code depends on it.
- Contracts in SPEC §5, §9 and §11 are FIXED. Do not rename fields or change shapes.
- All model output is untrusted. Validate with zod before use. TypeScript `strict: true`. No `any`; use `unknown` and narrow.
- Prompts in SPEC §7.2 are copied verbatim into `src/server/gemma/prompts.ts`.
- Maximum three Gemma steps (extract, analyze, finalize), plus the single re-ask or fallback SPEC allows. No `ai.chats`; the server is stateless. One Gemma call in flight at a time.
- In Gemma calls, images go before text.
- Use only the dependencies in SPEC §3. Any other dependency needs a `docs/DECISIONS.md` entry first (see "UI libraries" below for the expected ones).
- Uploaded images are never stored anywhere: not in `localStorage`, not in project files, not in the cloud.
- UI text is plain English. Use the exact strings from SPEC §10 and §10.5.

## Code conventions

- `src/core` is pure TypeScript. It must not import from `src/server`, `src/app` or `src/components`, and uses no Next, network or Node-only APIs.
- `src/components` may import `src/core` but never `src/server`.
- Every string that comes from the model or from a project file is rendered as plain text through React's default escaping. Never use `dangerouslySetInnerHTML`.
- Mermaid is loaded with a dynamic import inside `useEffect`, never on the server, with `securityLevel: 'strict'`.
- Checker output must be deterministic: same input gives the same findings in the same order.
- No `console.log` of user text, images or the API key. One `console.info` line per Gemma call as in SPEC §12.3.
- Keep files small and named as in SPEC §4. If you need a new file outside that layout, log it in DECISIONS.md.

## UI libraries

The UI uses Tailwind, shadcn/ui as the base, and animated components from **Skiper UI** and **Watermelon UI**. Read `docs/design.md` before any UI work. Short version:

- Components are copied into the repo through the shadcn CLI. Review every installed file, then adapt it to the design tokens.
- Remove any remote image, remote font or external script from a copied component. SPEC §13 forbids them.
- Use only free components. Do not use 21st.dev installs that need an API key.
- Log each component you install in the Component Log table at the end of `docs/design.md`.
- Animation is presentation only. It must never change behavior, text, or what a button does, and it must respect `prefers-reduced-motion`.
- When the owner gives a reference screenshot, follow the "Reference images" procedure in `docs/design.md`. Do not copy logos, brand text or artwork from a reference.

## Secrets and safety

- The Gemini key lives only in `.env.local` and server code. Never print it, never read `.env*` files, never commit them. Only `.env.example` is committed.
- Never prefix the key with `NEXT_PUBLIC_`. Before finishing, search the build output for the key string and for `NEXT_PUBLIC_GEMINI`.
- Milestone M7 (accounts) is built only if the owner explicitly asks. Never use a Supabase service-role key. Never loosen Row Level Security to make a test pass.
- Do not run destructive commands (`rm -rf` outside `node_modules` and `.next`, `git reset --hard`, force pushes) without asking.

## When you are tempted to do something extra

Stop. Check `docs/nongoals.md`. If the idea is not in SPEC §2.1, write it under "Ideas for later" in `docs/DECISIONS.md` and continue with the milestone.

## Definition of done

Before declaring the project finished, tick every item in SPEC §18 inside `docs/FINAL_REPORT.md`, including measured token usage per step from real Gemma calls, deviations, failures and known limitations.
