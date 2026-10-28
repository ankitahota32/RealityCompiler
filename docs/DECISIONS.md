# Decisions

Choices made where SPEC.md is silent, plus dependency and version records (SPEC §0 rules 3 and 9).

| Date | Question | Choice | Reason |
|---|---|---|---|
| 2026-10-29 | The project documents arrived as `RealityCompiler_Build_Spec (1).md`, `CLAUDE (1).md`, `architecture (1).md`, `design (1).md` and `nongoals.md` at the root. Where do they go? | Renamed to `SPEC.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/design.md`, `docs/nongoals.md`. | Matches SPEC §4 and the document order in CLAUDE.md. Contents unchanged. |
| 2026-10-29 | `create-next-app` refuses a folder that already holds `SPEC.md` and `CLAUDE.md`. | Generated the app in a temporary folder and copied the files in. Dropped the template's sample SVGs, favicon and Google fonts (`next/font/google`). | SPEC §13: system fonts only, no remote assets. |
| 2026-10-29 | The Next 16.4 template turns on `cacheComponents` and `partialPrefetching`. | Removed both; plain Next defaults. Kept the template's `@tailwindcss/turbopack` CSS rule (it replaces the PostCSS config). | Not asked for by SPEC; they change caching semantics of pages and route handlers. |
| 2026-10-29 | The template adds `AGENTS.md`, and `next dev` re-creates it if removed. | Keep and commit it. | It only points agents to the bundled Next docs. It does not override SPEC or CLAUDE.md. |
| 2026-10-29 | vitest 5 needs `@types/node` 22 or newer; the template pins `^20`. | `@types/node@^22`. | Local runtime is Node 22.13. SPEC §3 needs Node 20 or newer, so 22 types are accurate for this machine. |
| 2026-10-29 | The template's `LayoutProps<"/">` is a type generated into `.next/`, so `npm run typecheck` fails on a clean checkout. | Typed `children` explicitly in `layout.tsx`. | `typecheck` must pass without a prior `dev` or `build`. |
| 2026-10-29 | `tsconfig.json` strictness beyond `strict: true`. | Added `noUncheckedIndexedAccess`. | Core logic indexes arrays a lot; this catches missing-element bugs at compile time. |
| 2026-10-29 | `test` with zero test files. | `vitest run --passWithNoTests`. | M0 "Done when" allows zero tests. |
| 2026-10-29 | `shadcn init` (style `base-nova`) also installed a `button` component with `@base-ui/react`, and added `shadcn` as a runtime dependency. | Removed `button.tsx` and `@base-ui/react` (components come in M4). Moved `shadcn` to devDependencies; it is only used for the `shadcn/tailwind.css` import at build time. Reviewed: no install scripts, no remote URLs or imports. | Keep M0 to the plan; keep runtime dependencies small. |
| 2026-10-29 | design.md expects `clsx` + `tailwind-merge` for `cn()`. Current shadcn uses the `cn` package instead. | Keep `cn` (`src/lib/utils.ts` re-exports it). | It is shadcn's own drop-in replacement for clsx + tailwind-merge (github.com/shadcn-ui/cn, MIT). Vendored components import `cn` from `@/lib/utils`, so either works. |
| 2026-10-29 | Theme tokens. | design.md §2 tokens in `globals.css`, shadcn variables mapped to them, dark variant on `prefers-color-scheme`. Added `--on-brand` (text on brand buttons: white in light, `--paper` in dark), the motion tokens of design.md §4, and `--radius: 10px` so `rounded-sm/lg/xl` = 6/10/14 px. Dropped shadcn's chart and sidebar variables. | design.md §2 and §4; chart and sidebar are not used. |
| 2026-10-29 | M1: `NONDETERMINISTIC` ids. The §5.2 formula gives every conflicting event in the same state the same id. | `f_nondeterministic_<stateId>_<eventId>` for this rule only. All other ids follow §5.2. | Ids must be unique. Approved by the owner. |
| 2026-10-29 | M1: §11 export input has no way to look up titles of resolved findings, which spec.md §7 "Decisions" needs. | `ExportData` adds `findings` (the Step 3 list). Titles and questions are looked up there, then in `remainingFindings`; unknown ids fall back to the id. | Additive; nothing renamed or removed. Approved by the owner. |
| 2026-10-29 | M1: `MatrixRow` shape is not defined in SPEC. | `{ stateId, label, timeout, failure, cancel, duplicate }`, cells `handled \| missing \| na`. | Simplest shape the UI can render without a lookup. Approved by the owner. |
| 2026-10-29 | M1: id of `MULTIPLE_INITIAL`. | `f_multiple_initial_machine`. | It is a machine-level rule (§6.2 rules 1 to 4). |
| 2026-10-29 | M1: `{initial}` when there is not exactly one initial state. | "the start". | §6.4 gives "the start" for none; the same reading for several. |
| 2026-10-29 | M1: a question would have fewer than 2 options (for example `NO_INITIAL` on a machine with no states). | Pad with `Not sure yet`. | Schema needs 2 to 4 options; the string already exists in §6.4. |
| 2026-10-29 | M1: generated text over schema limits (two 60-character labels). | Finding titles cut to 120, question text to 200, scenario titles to 140. | Generated data must always pass its own schema. |
| 2026-10-29 | M1: matrix with zero or several initial states. | No rows. | Reachability is undefined then (§6.1). |
| 2026-10-29 | M1: a patch transition whose id already exists. §7.4 step 3 reads as `PATCH_BAD_REF`. | `PATCH_DUPLICATE_ID:<id>`, same as states and events. Unknown references stay `PATCH_BAD_REF`. `PATCH_CAP:<kind>` is warned once per kind. | Consistent warnings; still dropped either way. |
| 2026-10-29 | M1: where shared constants and graph helpers live. | `CHECKER_RULES` and `HANDLER_KINDS` in `types.ts` (avoids a checker ↔ merge import cycle). `reachableStates`, `kindsOut`, `requiredKinds` exported from `checker.ts` and reused by `matrix.ts`. `orderScenarios` (export order) in `scenarios.ts`. | No new files outside SPEC §4. One source for the §6.3 logic. |
| 2026-10-29 | M1: how `mergeFindings` orders state and kind without the machine (its §6.6 signature has none). | Stable sort by severity, source, rule order. State and kind order come from `runChecks`, which emits in that order; AI findings keep their order. | Signature stays as in SPEC; tested with a shuffled input. |
| 2026-10-29 | M1: spec.md details §11.2 leaves open. | A blank line after every heading and between sections. Booleans `Yes`/`No`; End column shows `none`/`success`/`failure`. Transition table shows labels (ids are in sections 3 and 4). "Open issues" counts remaining findings not accepted. Empty "Per transition" shows `None.`. | Readable output; ids remain available in `machine.json`. |
| 2026-10-29 | M1: newlines at file ends. | `toMermaid` has no trailing newline (it is embedded in spec.md). spec.md, the Gherkin file and the Playwright file end with exactly one newline. One blank line between Playwright tests. | Conventional text files; deterministic. |
| 2026-10-29 | M1: §11.1 and §11.7 say "trim, cut" in that order. | Followed literally: a label or file name cut at the limit can end in a space or `-`. | Exact formats are FIXED; not worth a deviation. |
| 2026-10-29 | M1: project file with `version` that is not a number (for example `"1"`). | `INVALID`. | §11.7 step 3: `version !== 1` for any other reason. |
| 2026-10-29 | M1: test helpers and config. | `tests/core/fixtures.ts` (fixture loaders, a compact machine builder, the end-of-flow export data). `vitest.config.ts` renamed to `vitest.config.mts` (Vite warned it was loading ESM as CommonJS). `.gitattributes` sets LF line endings for exact-text tests. | Not test files, so outside the §4 `*.test.ts` names. |
| 2026-10-29 | M1: enforcing "src/core is pure". | ESLint `no-restricted-imports` on `src/core/**` blocks Next, React, Node built-ins and the other layers. | Turns a CLAUDE.md rule into a lint error. |
| 2026-10-29 | M1: converting AI gap proposals into findings (§7.2 step 2 post-processing). | Deferred to M3 with the analyze step and `/api/demo`. | Not in the M1 module list. |

## Installed versions

Recorded 2026-10-29 at M0 (SPEC §3, design.md §5).

| Package | Version | Kind |
|---|---|---|
| next | 16.4.3 | dependency |
| react, react-dom | 19.3.0 | dependency |
| zod | 4.6.7 | dependency |
| @google/genai | 2.31.0 | dependency |
| mermaid | 12.2.0 | dependency |
| motion | 14.7.1 | dependency (design.md) |
| class-variance-authority | 0.7.1 | dependency (shadcn) |
| cn | 0.5.0 | dependency (shadcn) |
| lucide-react | 1.63.0 | dependency (shadcn) |
| tw-animate-css | 1.4.0 | dependency (shadcn) |
| typescript | 5.9.3 | dev |
| tailwindcss, @tailwindcss/turbopack | 4.3.3 | dev |
| eslint | 9.39.5 | dev |
| eslint-config-next | 16.4.3 | dev |
| vitest | 5.0.5 | dev |
| tsx | 4.23.15 | dev (SPEC §15 allows it) |
| shadcn | 4.23.0 | dev (CSS import only) |
| @types/node | 22.20.5 | dev |
| @types/react, @types/react-dom | 19.3.0 | dev |

Runtime: Node 22.13.0, npm 11.4.2.

## Ideas for later

None yet.
