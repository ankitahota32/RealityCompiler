# RealityCompiler: design system

This file controls how the UI looks and moves. It never changes behavior, exact strings, API calls or data contracts. Those come from `SPEC.md` (§10 and §10.5). If this file conflicts with SPEC, SPEC wins.

## 1. Design idea

RealityCompiler checks plans before code exists. The interface should feel like a **drafting table**: calm, precise, and a little technical. People arrive with a rough idea and leave with a clean specification, so the screen should get quieter and clearer as they move through the four steps.

- **The one memorable thing:** the state-machine diagram. It sits on a faint drafting-paper grid and is the visual center of Steps 2 and 4. Everything else stays quiet.
- **The one orchestrated motion moment:** arriving at Step 3. The severity summary fills in and the finding cards settle in once, in order. Everything else that moves answers a user action.
- **Voice:** plain, direct, sentence case. The exact strings in SPEC §10 are the voice.

Avoid the generic look: no gradient washes, no identical rounded cards with the same shadow, no all-caps eyebrow labels above every heading, no decorative numbering. Structure (borders, badges, tables) must carry real information.

## 2. Tokens

System fonts only (SPEC §13). Light and dark follow `prefers-color-scheme` (SPEC §10). There is no theme switcher.

### Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F5F7FA` | `#0D1420` | Page background |
| `--surface` | `#FFFFFF` | `#141D2E` | Cards, panels, inputs |
| `--ink` | `#101B33` | `#E6ECF5` | Main text |
| `--ink-muted` | `#53627C` | `#9AA9C2` | Secondary text, help text |
| `--line` | `#D5DCE6` | `#26324A` | Borders, dividers |
| `--brand` | `#2450D6` | `#7C9BFF` | Primary buttons, links, focus ring, selected option |
| `--verified` | `#0B7A75` | `#4FD1C5` | "Checked by code" badge |
| `--ai` | `#5B3FD0` | `#A99BFF` | "Suggested by AI" badge |
| `--sev-high` | `#B3261E` | `#FF8A80` | HIGH badge |
| `--sev-medium` | `#8A5A00` | `#FFC266` | MEDIUM badge |
| `--sev-low` | `#3F5870` | `#A9BCD0` | LOW badge |
| `--grid` | `#E3E9F1` | `#1B2740` | Drafting-paper grid behind diagrams |

Rules: body text and badge text must reach 4.5:1 contrast against their background in both modes. Verify when you implement; adjust the hex value, not the rule. Color is never the only signal: severity is a text badge, handled and missing cells in the matrix also show `✓` and `✗`.

### Type (system stack)

```
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

| Role | Size / line height | Weight |
|---|---|---|
| Step title | 28 / 34 | 650 |
| Section title | 20 / 28 | 600 |
| Body | 16 / 24 | 400 |
| Small, help text, badges | 14 / 20 | 450 |
| Ids, evidence, code | 13 / 20, mono | 400 |

Line length at most 70 characters for prose. Mono is used only for ids and code, not for decorative labels. Badges (`HIGH`, `MEDIUM`, `LOW`) are uppercase because SPEC fixes that text; nothing else is uppercase.

### Shape, space, elevation

- Radius by role, not one value everywhere: 6 px for inputs, buttons and badges; 10 px for panels and cards; 14 px for dialogs.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Page gutter 16 px on phones. Content max width 960 px, centered. Step 2 may use two panes from 1024 px up.
- Borders do the separating. Shadows only on dialogs and floating menus (one soft shadow). No shadow on cards.
- Touch targets at least 44 px high. No horizontal page scroll at 375 px (the diagram container may scroll).

### Tailwind v4 wiring (`src/app/globals.css`)

```css
@import "tailwindcss";

/* shadcn init adds a class-based dark variant. Replace it: SPEC §10 wants prefers-color-scheme. */
@custom-variant dark (@media (prefers-color-scheme: dark));

:root {
  --paper: #F5F7FA; --surface: #FFFFFF; --ink: #101B33; --ink-muted: #53627C;
  --line: #D5DCE6; --brand: #2450D6; --verified: #0B7A75; --ai: #5B3FD0;
  --sev-high: #B3261E; --sev-medium: #8A5A00; --sev-low: #3F5870; --grid: #E3E9F1;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0D1420; --surface: #141D2E; --ink: #E6ECF5; --ink-muted: #9AA9C2;
    --line: #26324A; --brand: #7C9BFF; --verified: #4FD1C5; --ai: #A99BFF;
    --sev-high: #FF8A80; --sev-medium: #FFC266; --sev-low: #A9BCD0; --grid: #1B2740;
  }
}
@theme inline {
  --color-paper: var(--paper);   --color-surface: var(--surface);
  --color-ink: var(--ink);       --color-ink-muted: var(--ink-muted);
  --color-line: var(--line);     --color-brand: var(--brand);
  --color-verified: var(--verified); --color-ai: var(--ai);
  --color-sev-high: var(--sev-high); --color-sev-medium: var(--sev-medium); --color-sev-low: var(--sev-low);
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
body { background: var(--paper); color: var(--ink); font-family: var(--font-sans); }
.drafting-grid {
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

shadcn also generates its own variables (`--background`, `--foreground`, `--primary`, and so on). Map them to the tokens above (for example `--primary: var(--brand)`, `--background: var(--paper)`, `--border: var(--line)`) so every vendored component follows this palette.

## 3. Layout

Single page, one column, step content swaps in place. Header on every step: product name on the left, `Save project file` and `Open project file` on the right (stacked or in a menu on phones).

```
Phone (375 px)                      Desktop (1024 px and up)
+----------------------+            +--------------------------------------------+
| RealityCompiler  [..]|            | RealityCompiler        [Save] [Open]       |
| Step 1 2 3 4 (bar)   |            | Step 1 -- 2 -- 3 -- 4                       |
|                      |            |                                            |
| Step title           |            | Step title                                 |
| content (stacked)    |            | Step 2:  +---------------+ +-------------+ |
|                      |            |          | diagram on    | | editor tabs | |
| [ primary action ]   |            |          | drafting grid | | States...   | |
+----------------------+            |          +---------------+ +-------------+ |
                                    | [ secondary ]              [ primary ]     |
                                    +--------------------------------------------+
```

Per step:

- **Step 1, Show us your plan:** form on the left-aligned single column. Flow name, flow type, text area with live counter, dropzone with thumbnails, privacy note (always visible), help text line, then `Read my plan` (primary) and `Try the demo` (secondary).
- **Step 2, Does this match your plan?:** diagram on the drafting grid, `Show as list` toggle, editor tabs, live line `{n} structural issues right now`, `Find gaps` primary. Low-confidence items show a `Check this` badge with the evidence text.
- **Step 3, What did we miss?:** summary bar (counts by severity and `{decided} of {total} decided`), `Show completeness table` toggle, finding cards sorted per SPEC §6.6, `Build my spec` primary.
- **Step 4, Your specification:** tabs Map, Rules, Scenarios, Open issues, Export. Token footer line at the bottom.

Alignment: all text left-aligned. Buttons that move the wizard forward sit bottom-right on desktop and full width on phones.

### Finding card anatomy

```
+------------------------------------------------------------+
| [HIGH]  [Checked by code]                                  |  badges (text + color)
| "Credit Check" has no timeout handling                     |  title
| What could go wrong, one plain sentence.                   |  description
| States: Credit Check                                       |  related states
| ---------------------------------------------------------- |
| What should happen if "Credit Check" gets no answer?       |  question
| ( ) Retry automatically, then show an error                |  options (radio-style)
| ( ) Show an error and let the user retry                   |
| [ Write my own answer ........................ ]           |
| [Accept as-is]  [Decide later]                             |
+------------------------------------------------------------+
```

AI cards also carry the note `AI suggestion, not verified by code`. Checked-by-code and AI badges must differ in both color and text.

## 4. Motion

Library: `motion` (the package behind Framer Motion; Watermelon UI is built on it). Import from `motion/react`.

Tokens:

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120 ms | Hover, press, toggle |
| `--dur-base` | 200 ms | Panel and tab changes, step crossfade |
| `--dur-slow` | 320 ms | The Step 3 arrival moment |
| Ease | `[0.2, 0, 0, 1]` | Everything entering. Exits are shorter |

Rules:

1. **Motion answers actions.** Open, expand, select, confirm, switch tab, change step. Idle motion that nobody triggered is not allowed, except the one Step 3 arrival moment.
2. **Step 3 arrival (the signature moment, plays once per arrival):** the severity summary counts up and its bar fills over 320 ms, then the first 8 finding cards fade and rise 8 px with a 40 ms stagger. Cards beyond 8 appear instantly. Do not replay it when the user edits an answer.
3. **Step change:** crossfade 200 ms, no sliding, no layout jump.
4. **Loading:** the exact loading text from SPEC §10.2 (`Reading your plan…`, `Looking for gaps…`, `Writing your specification…`) with a quiet shimmer or skeleton. After 10 seconds the text `Still working. The free tier can be slow.` appears. Announce loading text with `aria-live="polite"`.
5. **Reduced motion:** wrap the app once in `<MotionConfig reducedMotion="user">`. With reduced motion, replace movement with an instant change or a plain opacity fade. Test it.
6. **Never animate:** the Mermaid diagram, table row heights while the user types, or anything that moves the text the user is reading.
7. **Performance:** animate only `opacity` and `transform`. No blur filters on large areas. No animation work while a request is running other than the loading indicator.
8. **Banned:** parallax, scroll-jacking, cursor effects, marquees, particles, looping backgrounds, bouncing buttons, confetti.

## 5. Component sourcing: shadcn, Skiper UI, Watermelon UI

All three are copy-paste shadcn-style registries. The code is copied into this repo and is fully editable. Nothing is imported from a remote package at runtime.

### Setup (done once in M0)

1. Initialize shadcn (`npx shadcn@latest init`), accept the `src/` layout and TypeScript. Components go to `src/components/ui/`.
2. Apply the tokens from section 2 and fix the dark variant as shown.
3. Install `motion`. Log the exact versions of `motion`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` and any Radix packages in `docs/DECISIONS.md` (SPEC §0 rule 9).
4. Optional but recommended: add the Watermelon MCP server so Claude Code can search its components: `claude mcp add --transport http watermelon https://mcp.watermelon.sh/mcp`.

### Installing a component

- **Skiper UI:** `npx shadcn add @skiper-ui/skiperNN` where `NN` is the component number shown on skiper-ui.com. Only free components. If the `@skiper-ui` namespace is not recognized, follow the install section of the Skiper UI docs.
- **Watermelon UI:** `npx shadcn@latest add https://registry.watermelon.sh/r/<component-name>.json`. The component name comes from ui.watermelon.sh or from the Watermelon MCP search.
- Do not use 21st.dev mirrors that require an API key.

### After every install (checklist)

1. Open the new file and read it. Do not trust it blindly.
2. Remove any remote image URL, remote font, external script or network call. Replace images with CSS shapes or nothing.
3. Replace hard-coded colors with the tokens in section 2. Replace hard-coded fonts with `--font-sans`.
4. Make sure it uses `prefers-reduced-motion` correctly (through `MotionConfig` or `useReducedMotion`).
5. Make it keyboard accessible with a visible focus ring (`--brand`, 2 px, offset 2 px).
6. Make sure all text comes from props so SPEC's exact strings can be passed in.
7. Run `npm run typecheck && npm run lint`. Fix issues in the copied file.
8. Add a row to the Component Log (section 8). Log any new dependency in `docs/DECISIONS.md`.

### Where to use which kind of component

The owner picks the final look from the libraries. This table says what each slot needs. Do not invent component names; look them up in the registry.

| Slot | What it needs | Preferred source |
|---|---|---|
| Wizard progress (`StepHeader`) | Four steps, current step clear, animated fill between steps | Skiper UI or Watermelon animated stepper or progress |
| Dropzone (`ImageDropzone`) | Click and drag, hover and drag-over state, thumbnails with remove | Animated file upload from either library |
| Option choice in `FindingCard` | Radio-style, keyboard accessible, clear selected state | Animated radio group or segmented choice |
| Tabs (`MachineEditor`, `ResultTabs`) | Animated active indicator | Animated tabs |
| Severity summary | Count-up numbers and a filling bar | Animated number and progress |
| Loading text | Quiet shimmer on the exact loading strings | Shimmer or skeleton text |
| Buttons | Plain, with a subtle press and hover. One animated primary style at most | shadcn button, optionally an animated variant |
| Confirm dialogs (delete, replace project, start over) | Accessible modal | shadcn dialog (no extra animation needed) |
| Notices (`Project file downloaded.`, `Project loaded.`) | Inline, non-blocking | Plain styled notice |
| Everything else (tables, inputs, selects, toggles, badges) | Boring and readable | shadcn base |

Keep the number of animated vendor components small. The diagram is the star; animation should not compete with it.

## 6. Reference images (inspiration from a website or UI)

The owner may provide a screenshot of a site or UI to take inspiration from. Reference images are development material only: keep them in `design/references/`, never in `public/`, never shipped, never sent to Gemma.

Procedure when a reference is provided:

1. **Analyze before coding.** Write a short Reference Analysis (put it in `design/references/<name>.md`):
   - Layout: grid, columns, density, alignment, where the focus is.
   - Spacing rhythm and radius habits.
   - Color feel (palette as hex values, light or dark, accent usage).
   - Type: weight, size contrast, line length.
   - Motion style (what moves, how fast, what triggers it), if visible or described.
   - Which parts could help which RealityCompiler slot (section 5 table).
2. **Propose a delta.** List exactly which tokens or component choices in this file would change, and why. Keep what must stay: system fonts, text badges for severity, exact strings, the four-step wizard, the diagram as the focus.
3. **Wait for approval.** Do not touch tokens or components until the owner agrees.
4. **Apply.** Update section 2 of this file first, then the code. Update the Component Log.
5. **Never copy.** Do not reproduce logos, brand names, photos, illustrations, copy text or distinctive artwork from the reference. Take structure, spacing, color feel and motion style only.
6. **Never break the floor** (section 7), even if the reference does.

## 7. Quality floor (applies to every screen)

- Works at 375 px with no horizontal page scroll. Test also at 768 and 1280 px.
- Light and dark both look intentional. Test both.
- Every interactive element is keyboard reachable with a visible focus ring.
- Contrast at least 4.5:1 for text. Severity and source are always text badges, never color alone.
- Reduced motion respected.
- All model-provided and file-provided strings render as plain text.
- Loading, empty and error states exist for every step. Error copy is exactly the strings in SPEC §10.4. Errors say what happened and what to do, and do not apologize.
- No layout shift when the diagram renders. Reserve its height.
- Buttons that start a request are disabled while it runs (SPEC §10.2).
- Labels name things the way users do (`Waits for outside`, `Needs user input`), not how the system is built.

## 8. Attribution

Free Skiper UI components require attribution. If any Skiper UI component is used, add a small footer line `Some animations from Skiper UI.` linking to skiper-ui.com, and mention it in the README. Watermelon UI is MIT licensed; keep the license notice in the README. Log this decision in `docs/DECISIONS.md`.

## 9. Component Log

Fill one row per installed or adapted vendor component.

| Date | Component | Source (Skiper UI / Watermelon UI / shadcn) | Install command | Used in | Free / Pro | Changes made | New dependencies |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
