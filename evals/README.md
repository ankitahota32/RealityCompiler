# Evals

`npm run eval` checks whether RealityCompiler finds the gaps a person already knows are in a plan. For every case in `evals/cases/` it runs the real **extract** and **analyze** steps (no finalize), then counts how many of the case's seeded gaps were found.

It needs `GEMINI_API_KEY` in `.env.local` and refuses to run with `MOCK_GEMMA=1`, because the point is to measure the real model. Each case costs about two Gemma calls (three if the analyze step needs its one allowed retry), roughly 10K to 16K tokens. Run it on the free tier with that in mind.

## Output

```
| Case | Seeded | Found | Recall | Tokens | Baseline recall | Notes |
|---|---|---|---|---|---|---|
| bnpl-checkout | 4 | 2 | 50% | 16269 | – | extract 2135, analyze 14134 tokens; 8 checker + 3 AI findings; missed g3, g4; 352 s |
```

- **Recall** = seeded gaps found ÷ seeded gaps.
- **Notes** lists which gaps were missed and any warning, such as `AI_GAPS_UNAVAILABLE`, which means the AI part of analyze failed and only the checks by code ran.
- To try another model, set it for one run: `GEMMA_MODEL_EXTRACT=gemma-4-26b-a4b-it npm run eval`.

## Add a case

Create `evals/cases/<id>.json`:

```json
{
  "id": "hotel-booking",
  "name": "Hotel booking",
  "flowType": "booking",
  "text": "Plain description of the flow, at most 4000 characters.",
  "imagePaths": [],
  "seededGaps": [
    {
      "id": "g1",
      "description": "Payment provider never answers",
      "matchChecks": [{ "ruleId": "MISSING_HANDLER", "requiredKind": "timeout" }],
      "matchKeywords": ["timeout", "no answer"]
    }
  ]
}
```

| Field | Rules |
|---|---|
| `id` | Lowercase letters, digits and dashes. Also names the baseline file. |
| `flowType` | `payments`, `auth`, `booking`, `order`, `generic` or `auto`. |
| `imagePaths` | Up to 3 JPEG, PNG or WEBP files, relative to the repo root (for example `evals/images/hotel.jpg`). Do not commit private sketches. |
| `seededGaps` | At least one. Write them **before** running the eval, from what you know is missing. |

A seeded gap counts as **found** when either:

1. a finding has the same `ruleId` as a `matchChecks` entry (and the same `requiredKind`, if the entry gives one). Rule ids: `NO_INITIAL`, `MULTIPLE_INITIAL`, `NO_SUCCESS_TERMINAL`, `NO_FAILURE_TERMINAL`, `UNREACHABLE_STATE`, `DEAD_END_STATE`, `NO_PATH_TO_TERMINAL`, `TERMINAL_HAS_OUTGOING`, `NONDETERMINISTIC`, `MISSING_HANDLER`. Handler kinds: `timeout`, `failure`, `cancel`, `duplicate`. Leave `matchChecks` empty for gaps only the AI could find.
2. or a finding's title plus description contains one of `matchKeywords` (case does not matter). Pick short words a correct answer must use.

## Compare with a plain chatbot (baseline)

1. Paste the case `text` into any chat assistant and ask: "What is missing from this flow?"
2. Save its whole answer as `evals/baselines/<id>.txt`.
3. Run `npm run eval`. The **Baseline recall** column scores that answer with the keyword rule only.
