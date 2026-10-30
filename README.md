# RealityCompiler

A plan checker for software ideas. Show it a plan (a sketch photo, a screenshot or typed text). Gemma 4 turns the plan into a state machine, plain code checks it for gaps (dead ends, unreachable screens, missing timeouts, failures, cancels and double taps), you answer a question about each gap, and you download a specification.

**The model proposes, code verifies.** The AI drafts the map and suggests extra gaps; every structural check is deterministic code in `src/core`, so the same plan always gives the same findings. AI suggestions are always labelled `Suggested by AI`.

## Run the demo in under 5 minutes (no API key)

Needs Node.js 22 or newer.

```
git clone https://github.com/ankitahota32/RealityCompiler.git
cd RealityCompiler
npm install
```

Start it in mock mode, which answers from built-in fixtures and never calls Google:

```
# macOS / Linux / Git Bash
MOCK_GEMMA=1 npm run dev

# Windows PowerShell
$env:MOCK_GEMMA="1"; npm run dev
```

Open http://localhost:3000, click **Get started**, then **Try the demo**. You land on Step 3 with 12 gaps for a "Buy now, pay later" checkout: 9 checked by code and 3 suggested by AI.

## Use it with the real model

1. Get a free API key from Google AI Studio.
2. Copy the example settings and add the key:
   ```
   cp .env.example .env.local
   ```
   Open `.env.local` and set `GEMINI_API_KEY=...`. Never put the key anywhere else, and never commit `.env.local` (it is git-ignored).
3. `npm run dev`, open http://localhost:3000/app.

### Settings (`.env.local`)

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | – | Required unless `MOCK_GEMMA=1`. Server only. |
| `GEMMA_MODEL_EXTRACT` | `gemma-4-31b-it` | Model that reads your sketch or text (Step 1). |
| `GEMMA_MODEL_ANALYZE` | `gemma-4-26b-a4b-it` | Model that suggests extra gaps (Step 2 → 3). |
| `GEMMA_MODEL_FINALIZE` | `gemma-4-26b-a4b-it` | Model that writes rules and scenarios (Step 3 → 4). |
| `MOCK_GEMMA` | `0` | `1` = offline fixtures, no key needed. |
| `TPM_LIMIT` | `16000` | Free-tier tokens per minute. |
| `TPM_SAFETY` | `14000` | The app keeps its own use below this per minute. |

Without a key and with `MOCK_GEMMA=0`, `/api/health` still answers and the other API routes return `Server is missing GEMINI_API_KEY.`

## Walkthrough

The site has a landing page (`/`), About (`/about`), Contact (`/contact`) and the app itself (`/app`), which is a four-step wizard.

1. **Show us your plan.** Enter a flow name, pick a flow type (or Auto-detect), and either drop up to 3 images (JPEG, PNG or WEBP) or type the flow. Sample text:
   > Buy Now Pay Later checkout. The user opens the cart and taps Proceed. On the Checkout Review screen the user enters details and taps Submit. The app then checks the user's credit with a bank. If credit is approved the user sees the Confirm Plan screen where they confirm and the order is placed. If credit is insufficient the user sees a Credit Declined screen. From Confirm Plan the user can cancel and go back to the cart.

   Click **Read my plan**.
2. **Does this match your plan?** Check the diagram. Fix anything the model read wrong in the States, Events and Transitions tabs. Items marked `Check this` were read with low confidence. The line `n structural issues right now` updates as you edit. Click **Find gaps**.
3. **What did we miss?** Each card is one gap. Pick an option, write your own answer, **Accept as-is** or **Decide later**. **Show completeness table** shows which states handle a timeout, failure, cancel or double submit. Click **Build my spec**.
4. **Your specification.** Map, Rules, Scenarios, Open issues and Export. The Export tab downloads or copies `spec.md`, `scenarios.feature`, `playwright-skeleton.spec.ts`, `machine.json` and `findings.json`. **How to use these files** explains what each file is for, where to put it in a project and how to start with it. The footer shows the tokens used this session.

Real calls are slow on the free tier: extract takes about 20 to 60 s, analyze 1 to 3 min, finalize 15 to 30 s. After 10 s the app says `Still working. The free tier can be slow.`

## Save and open a project file

Your work is saved automatically in this browser (`localStorage`), so a reload brings it back. To keep a copy or move it to another device:

- **Save project file** downloads `<flow-name>.rcproject.json`.
- **Open project file** loads one back (it asks first if you have work open).

Images are never saved: not in the browser, not in the project file, not anywhere else. After opening a file, the text, map, gaps, answers and result come back without the images. Files from a newer version, damaged files and other JSON files are rejected with a plain message.

## Privacy

What you submit (text and images) is sent to Google's Gemini API. Do not upload private or client material. The app has no accounts, no database, no analytics and no third-party scripts. Fonts are bundled with the app at build time.

## Tests and checks

```
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # vitest: core logic, server pipeline with the mock, UI state, eval scoring
npm run build
```

`npm run spike` re-runs the API checks of SPEC §17 and rewrites `docs/SPIKE.md` (needs the key).

## Eval

`npm run eval` runs the real extract and analyze steps on every case in `evals/cases/` and reports how many known gaps were found. It needs the key and refuses `MOCK_GEMMA=1`. See [evals/README.md](evals/README.md) for adding cases and comparing against a plain chatbot answer.

## Free-tier limits

- About 16K tokens per minute. One full run (extract, analyze, finalize) uses roughly 10K to 20K tokens, mostly in analyze because it thinks at a high level. The app waits or answers `The free limit is reached for now. Try again in N seconds.` with a countdown.
- At most one Gemma call runs at a time, and the app never makes more than the three steps plus one retry per step.
- Google's free models are sometimes busy (HTTP 500/503). The app retries twice, then shows an error you can retry.

## Known limitations

- Handwriting is read imperfectly; Step 2 exists to fix that.
- AI-suggested gaps are not verified by code. In the eval the AI part of analyze sometimes failed, leaving only the checks by code (see `docs/FINAL_REPORT.md`).
- The Playwright export is a skeleton with `TODO` steps; no real selectors exist for a plan.
- The demo and mock mode always return the same BNPL fixture, whatever you type.
- Only English. Dark theme only.

## Project docs

`SPEC.md` (source of truth), `CLAUDE.md` (how to work in the repo), `docs/architecture.md`, `docs/design.md`, `docs/nongoals.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/SPIKE.md`, `docs/FINAL_REPORT.md`.

Some site and UI components are adapted from shadcn/ui (MIT).
