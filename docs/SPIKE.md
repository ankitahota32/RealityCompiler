# Spike results

Written by `npm run spike` (SPEC §17). Run at 2026-10-28T21:33:58.393Z.

Models: extract `gemma-4-31b-it`, analyze `gemma-4-26b-a4b-it`, finalize `gemma-4-26b-a4b-it`. SDK `@google/genai` 2.31.0. Node v22.13.0.

A check that only got server errors (5xx, "high demand") is NOT TESTED, not FAIL: the feature was never exercised.

| # | Check | Result | Evidence | Decision |
|---|---|---|---|---|
| V1 | Both model ids answer a plain text prompt | PASS | gemma-4-31b-it: "OK" in 28654 ms; gemma-4-26b-a4b-it: "OK" in 2579 ms | Use the configured model ids. |
| V2 | Image input works and the model reads text in the sketch | PASS | Files API on gemma-4-31b-it: read "Clicked on Order order placed payment options", prompt tokens 276. Inline on gemma-4-31b-it: read "Clicked on Order -> Order Placed -> Payment options", prompt tokens 276. Pass = the reading contains "order", "placed" and "payment". | Keep the Files API path of SPEC §7.1. |
| V3 | Function calling with the nested submit_state_machine schema returns valid args | PASS | parameters on gemma-4-31b-it: call returned, 6 states, 6 events, 6 transitions, validateMachine ok | Pass declarations as `parameters`. |
| V4 | Thinking levels HIGH and MINIMAL accepted by both models | PASS | gemma-4-31b-it HIGH: "391", thoughts 81; gemma-4-31b-it MINIMAL: "391", thoughts 0; gemma-4-26b-a4b-it HIGH: "391", thoughts 226; gemma-4-26b-a4b-it MINIMAL: "391", thoughts 0 | Use thinkingConfig.thinkingLevel as SPEC §7.2 says. |
| V5 | Forcing a function call with toolConfig mode 'ANY' is accepted | PASS | gemma-4-31b-it: call returned {"answer":"Paris"}; gemma-4-26b-a4b-it: call returned {"answer":"Paris"} | Accepted. Whether to use it per step depends on V10 (forced vs unforced quality). |
| V6 | Usage metadata field names | PASS | Fields: promptTokenCount, candidatesTokenCount, totalTokenCount, promptTokensDetails, thoughtsTokenCount, serviceTier | Read promptTokenCount, candidatesTokenCount, totalTokenCount. totalTokenCount includes thoughtsTokenCount; candidatesTokenCount can be missing when the model returns nothing, so treat missing as 0. |
| V7 | Visual token budget can be set | PASS | config.mediaResolution LOW on gemma-4-31b-it: prompt tokens 84 vs default 276, reading still correct; part mediaResolution LOW on gemma-4-31b-it: prompt tokens ? vs default 276, reading still correct | Option exists. Keep the default for handwriting; the eval (M6) can test LOW. |
| V8 | Uploaded file deletion works | PASS | files.delete ok; files.get afterwards fails with 403 | Delete uploaded files in finally (SPEC §7.1 step 7). |
| V9 | Files API available on the free tier | PASS | Files API on gemma-4-31b-it: read "Clicked on Order order placed payment options", prompt tokens 276 | Files API usable. |
| V10 | Time per call for each step with realistic input | PASS | extract on gemma-4-31b-it 36813 ms, 2009 tokens; analyze SPEC: HIGH 4000 forced on gemma-4-26b-a4b-it 1435 ms, 1395 tokens (thoughts 0), 0 gaps (0 usable); analyze SPEC: HIGH 4000 on gemma-4-26b-a4b-it 85285 ms, 5375 tokens (thoughts 3997), no call (finish MAX_TOKENS); analyze HIGH 8000 on gemma-4-26b-a4b-it 98192 ms, 5977 tokens (thoughts 4243), 4 gaps (4 usable); analyze MEDIUM 4000: 400 Thinking level is not supported for this model.","status":"INVALID_ARG; analyze LOW 4000: 400 Thinking level is not supported for this model.","status":"INVALID_ARG; finalize unforced on gemma-4-26b-a4b-it 15163 ms, 2365 tokens, patch +2s/+2e/+2t, 0 warnings, patched machine valid, 9 findings remain; finalize forced on gemma-4-26b-a4b-it 17012 ms, 2466 tokens, patch +2s/+3e/+3t, 1 warnings, patched machine valid, 13 findings remain; sketch read on gemma-4-26b-a4b-it 2123 ms: "Clicked on Order -> order placed -> payment options" (correct); extract on gemma-4-26b-a4b-it 21244 ms, 2074 tokens, valid machine | Times recorded; copy to FINAL_REPORT. Analyze: SPEC: HIGH 4000 forced: 0 gaps (0 usable); SPEC: HIGH 4000: no call (finish MAX_TOKENS); HIGH 8000: 4 gaps (4 usable); MEDIUM 4000: no call (finish ?); LOW 4000: no call (finish ?). Finalize produced a valid patch: yes. |

## Calls

Times are for the successful attempt; a call that gave up shows the total time of all attempts.

| Call | Model | ms | Attempts | Prompt | Output | Thoughts | Total | Finish | Error |
|---|---|---|---|---|---|---|---|---|---|
| V1 plain text | gemma-4-31b-it | 28654 | 1 | 8 | 1 | 49 | 58 | STOP |  |
| V1 plain text | gemma-4-26b-a4b-it | 2579 | 1 | 8 | 1 | 75 | 84 | STOP |  |
| V4 thinking HIGH | gemma-4-31b-it | 53546 | 2 | 18 | 3 | 81 | 102 | STOP |  |
| V4 thinking MINIMAL | gemma-4-31b-it | 15322 | 2 | 18 | 3 |  | 21 | STOP |  |
| V4 thinking HIGH | gemma-4-26b-a4b-it | 5743 | 1 | 18 | 3 | 226 | 247 | STOP |  |
| V4 thinking MINIMAL | gemma-4-26b-a4b-it | 952 | 1 | 18 | 3 |  | 21 | STOP |  |
| V2 image via Files API | gemma-4-31b-it | 29637 | 1 | 276 | 12 |  | 288 | STOP |  |
| V2 image inline base64 | gemma-4-31b-it | 13121 | 1 | 276 | 10 |  | 286 | STOP |  |
| V7 config.mediaResolution LOW | gemma-4-31b-it | 9470 | 3 | 84 | 10 |  | 94 | STOP |  |
| V7 part mediaResolution LOW | gemma-4-31b-it | 13476 | 1 |  | 13 |  | 296 | STOP |  |
| V3 extract (parameters) | gemma-4-31b-it | 36813 | 2 | 1121 | 888 |  | 2009 | STOP |  |
| V5 toolConfig ANY | gemma-4-31b-it | 42974 | 2 | 49 | 16 |  | 65 | STOP |  |
| V5 toolConfig ANY | gemma-4-26b-a4b-it | 1253 | 1 | 49 | 16 |  | 65 | STOP |  |
| V10 analyze (SPEC: HIGH 4000 forced) | gemma-4-26b-a4b-it | 1435 | 1 | 1378 | 17 |  | 1395 | STOP |  |
| V10 analyze (SPEC: HIGH 4000) | gemma-4-26b-a4b-it | 85285 | 1 | 1378 |  | 3997 | 5375 | MAX_TOKENS |  |
| V10 analyze (HIGH 8000) | gemma-4-26b-a4b-it | 98192 | 1 | 1378 | 356 | 4243 | 5977 | STOP |  |
| V10 analyze (MEDIUM 4000) | gemma-4-26b-a4b-it | 810 | 1 |  |  |  |  |  | 400 Thinking level is not supported for this model.","status":"INVALID_ARG |
| V10 analyze (LOW 4000) | gemma-4-26b-a4b-it | 622 | 1 |  |  |  |  |  | 400 Thinking level is not supported for this model.","status":"INVALID_ARG |
| V10 finalize (unforced) | gemma-4-26b-a4b-it | 15163 | 2 | 1698 | 667 |  | 2365 | STOP |  |
| V10 finalize (forced) | gemma-4-26b-a4b-it | 17012 | 1 | 1698 | 768 |  | 2466 | STOP |  |
| V10 sketch read on alt model | gemma-4-26b-a4b-it | 2123 | 1 | 276 | 12 |  | 288 | STOP |  |
| V10 extract on alt model | gemma-4-26b-a4b-it | 21244 | 1 | 1121 | 953 |  | 2074 | STOP |  |

## Notes

- Raw usage metadata (V1): `{"promptTokenCount":8,"candidatesTokenCount":1,"totalTokenCount":58,"promptTokensDetails":[{"modality":"TEXT","tokenCount":8}],"thoughtsTokenCount":49,"serviceTier":"standard"}`
- Files API upload: state ACTIVE, mimeType image/jpeg.
- files.upload also accepts a Blob in this SDK version, so the server can upload without writing a temp file (SPEC §7.1 step 2 writes one).
- V3 extracted states: s_cart, s_checkout_review, s_credit_check, s_confirm_plan, s_order_placed, s_credit_declined. Checker findings on it: 7.
- Analyze (HIGH 8000) gaps: [high] Discrepancy between credit and total; [medium] Price or stock changes during credit check; [medium] Credit approval expiration; [low] Unreachable referral bonus screen
