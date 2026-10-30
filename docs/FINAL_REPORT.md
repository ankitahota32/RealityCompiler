# Final report

Written at the end of M6 (2026-10-29), per SPEC §0 rule 11 and §18.

## Definition of done

- [x] **Every milestone's "Done when" passed.** M0 to M3: see `docs/PROGRESS.md`. M4: the owner ran acceptance items 1, 2, 4, 5 and 6 in mock mode and committed (fe3bef2). M5: the five export files were built from a mock run and checked by the agent (all non-empty, `spec.md` has the Mermaid block); the owner committed after the item 3 checklist (5a975e0). M6: the commands below pass and `npm run eval` ran twice with the real API.
- [x] **`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.** 171 tests in 20 files.
- [x] **Fixture produces exactly the 9 findings of Appendix E; after the mock finalization exactly 7 remain.** `tests/core/checker.test.ts` (Appendix E), `tests/server/steps.test.ts` and `tests/server/routes.test.ts` (7 remaining).
- [x] **No `any`, no secrets in repo or client bundle.** No `any` in `src`, `scripts` or `tests`. `.env.local` was never committed. The build output has no `NEXT_PUBLIC_GEMINI` (checked on the final build). The search for the key string itself was done on the M3 and M4 builds; for the final build the owner runs it (the agent no longer reads `.env.local`, see Deviations).
- [x] **All five exports match §11 exactly.** `tests/core/export.test.ts` (inline expected text for `spec.md`, Gherkin, Playwright) and `tests/core/exportFiles.test.ts` (`machine.json`, `findings.json`).
- [x] **Every [VERIFY] item has a recorded result.** `docs/SPIKE.md`: V1 to V10 PASS.
- [x] **UI text matches §10 exact strings.** All wizard strings live in `src/components/copy.ts`, marked `SPEC` where exact; `tests/ui/apiClient.test.ts` checks the §10.4 error copy.
- [x] **Deviations and assumptions are listed in `docs/DECISIONS.md`.**
- [x] **README lets a new person run the demo in under 5 minutes.** `npm install`, `MOCK_GEMMA=1 npm run dev`, Get started, Try the demo. No key needed.
- [x] **Save/Open project file works (acceptance item 6) and `tests/core/project.test.ts` passes.**
- [x] **No uploaded image data appears in `localStorage` or in a saved project file.** Images live only in React state as Blobs; `toProjectData` drops them (`tests/ui/wizardState.test.ts`). There is no cloud storage.
- [x] **M7: `M7 not requested`.**

## What is done

- **Core (`src/core`, pure):** schemas, validation, the deterministic checker (10 rules), questions, completeness matrix, merge, patch, transition scenarios, Mermaid, the five exports, project files.
- **Server:** three Gemma steps (extract, analyze, finalize) behind `/api/extract`, `/api/analyze`, `/api/finalize`, plus `/api/demo` and `/api/health`; token budget (one call in flight, under 14K tokens and 25 requests per minute); IP limiter; image checks by magic bytes; mock client.
- **UI:** the four-step wizard at `/app` with editing, gap cards, matrix, result tabs, exports with copy, token footer, slow-call line, rate-limit countdown, autosave and project files. Owner additions: landing page, About, Contact, dark liquid-glass theme, custom fonts and micro-interactions.
- **Tooling:** `npm run spike` (API checks), `npm run eval` (recall on seeded gaps), one eval case (Appendix F).

## Deviations

All are logged in `docs/DECISIONS.md`. The main ones:

- **Analyze `maxOutputTokens` 8000 instead of 4000.** With HIGH thinking the model spent all 4000 on thoughts and returned nothing (spike V10).
- **No forced function calling.** Accepted by the API, but it gave 0 usable gaps in the spike.
- **Site pages and theme (owner request).** Landing `/`, `/about`, `/contact`, wizard moved to `/app`, dark only, Inter / Space Mono / Instrument Serif via `next/font`. SPEC §10, §13.6 and nongoals §5 were updated by the owner's decision.
- **Boujee accent font not added.** It waits for a licensed file from the owner.
- **Process slip.** At M4 the agent searched the build for the key with a command that read `.env.local`, which CLAUDE.md forbids. The key was not printed or stored. Since then the owner runs that check.

## Failures

- **Spike first run:** false FAILs from Google 500/503 errors. The spike now retries longer and marks server-error-only checks as NOT TESTED.
- **Eval run 1 (default models):** the AI part of analyze failed (`AI_GAPS_UNAVAILABLE`). The first analyze answer had no function call, so the client made the one retry SPEC §7.5 allows. That retry is not counted by the token budget, because it runs inside the same budget reservation. The two analyze calls together (about 7.1K + 8.5K) likely went past Google's 16K tokens per minute. The analyze step hides the exact error, so this cause is likely, not proven. In run 2 the two calls used 14.1K and succeeded. See Known limitations.
- **Eval token count:** when the AI part of analyze fails, its tokens are not added to the reported usage (run 1 shows 1,993 although the analyze call used 7,111).

## Token usage per step (real Gemma calls)

| Step | Model | Calls measured | Total tokens per call | Time |
|---|---|---|---|---|
| Extract (text only) | gemma-4-31b-it | spike, M3 route, eval run 1 | 2,009 · 2,002 · 1,993 | 37 s · 80 s (with route) · 56 s |
| Extract (text only) | gemma-4-26b-a4b-it | spike, eval run 2 | 2,074 · 2,135 | 21 s · 113 s |
| Analyze (HIGH, 8000 cap) | gemma-4-26b-a4b-it | spike, eval run 1, eval run 2 (two calls) | 5,977 · 7,111 · 5,667 + 8,467 | 98 s · 123 s · 90 s + 149 s |
| Finalize | gemma-4-26b-a4b-it | spike (two variants) | 2,365 · 2,466 | 15 s · 17 s |
| Image read (one sketch) | gemma-4-31b-it | spike | 276 prompt tokens per image (84 at LOW resolution) | – |

Most of the analyze total is thinking: prompt about 1.4K, visible output about 0.4K to 0.5K, thoughts 4K to 6.5K. A full run is about 10K tokens, or 18K when analyze needs its retry.

## Eval results

| Run | Extract model | Seeded | Found | Recall | Missed | AI findings | Tokens |
|---|---|---|---|---|---|---|---|
| 1 | gemma-4-31b-it | 4 | 2 | 50% | g3 (dead end), g4 (late approval) | 0 (AI_GAPS_UNAVAILABLE) | 1,993 counted (9,104 used) |
| 2 | gemma-4-26b-a4b-it | 4 | 2 | 50% | g3, g4 | 3 | 16,269 |

Both models marked Credit Declined as a failure end (a fair reading of the text), so the dead-end gap g3 did not appear. No baseline file exists yet, so there is no chatbot comparison. Model choice: no change. The 26b model matched the recall but was slower this time, the opposite of the spike, so two runs are not enough evidence to switch.

## Known limitations

- **Analyze retry and the token budget.** The §7.5 retry inside one call is not re-checked against the per-minute budget, so on the free tier the AI half of analyze can fail when the first answer has no function call. The checks by code still return. Suggested fix: count the retry in the budget (wait for room before the second attempt). This changes M3 code, so it is listed for the owner to approve.
- **Analyze is slow:** 1.5 to 4 minutes on the free tier with HIGH thinking.
- Handwriting reading is imperfect (Step 2 is the fix). AI findings are unverified suggestions.
- The demo and mock mode always return the BNPL fixture.
- Only one eval case; recall numbers are indicative only.
- Dark theme only; English only.

## M7

M7 not requested.
