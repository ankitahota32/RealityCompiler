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
