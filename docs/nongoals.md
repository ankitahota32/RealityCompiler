# RealityCompiler: non-goals

This file lists what must NOT be built or changed. It protects the scope of `SPEC.md`. If you think one of these is needed, do not build it. Write it under "Ideas for later" in `docs/DECISIONS.md` and keep going.

## 1. Product features that are out of scope (SPEC §2.2)

- Voice or audio input.
- Payments of any kind.
- Running Playwright tests inside the app. The app only exports a skeleton file.
- Jira, GitHub or any other integration. Exports are file downloads only.
- Reverse-engineering existing code into a state machine.
- Multi-user collaboration, comments, sharing, public project links.
- Image bounding-box overlays or annotations on the uploaded sketch.
- ZIP export. The five files download separately.
- Internationalization. The UI is plain English only.
- A chat interface. This is a guided four-step wizard, not a conversation.
- Storing uploaded sketch images anywhere: browser storage, project files, or the cloud.

## 2. Architecture non-goals (M0 to M6)

- No server-side database.
- No login, accounts, cookies or sessions. (Optional M7 is the only place these are allowed, and only if the owner explicitly asks.)
- No separate backend service. Route handlers inside the Next.js app are the backend.
- No multi-turn model chat (`ai.chats`). The server is stateless.
- No more than the three Gemma steps (extract, analyze, finalize), plus the single re-ask or fallback SPEC allows. Do not add "verify" or "improve" model passes.
- No other model providers, no model switching UI.
- No background jobs, queues or streaming responses.
- No extra state-management library. `useReducer` is the state tool.
- No ORM, no GraphQL, no tRPC.
- No analytics, telemetry, error-tracking SaaS, or third-party scripts.
- No dependencies outside SPEC §3 without a `docs/DECISIONS.md` entry made first.

## 3. Behavior non-goals

- Do not make the model do structural checks. Dead ends, unreachable states, missing handlers and the rest stay in `src/core/checker.ts`.
- Do not count AI findings as machine-verified. Keep the `Suggested by AI` badge and the note `AI suggestion, not verified by code`.
- Do not generate real CSS or XPath selectors in Playwright output. None exist. Keep behavior-level scenarios and `TODO` steps.
- Do not remove or skip Step 2 (review and edit the map). Handwriting is read imperfectly, so Step 2 is required.
- Do not let the extraction prompt invent timeout, failure, cancel or duplicate handling the input does not show. Finding those is the checker's job.
- Do not change the fixed contracts: types and enums (§5), endpoints and error codes (§9), export formats (§11), project file layout (§11.7).
- Do not edit the fixtures in `fixtures/` to make a test pass. Fix the code.
- Do not add domain-pack checklist items. Only the owner extends the packs.
- Do not "fix" the known risks in SPEC Appendix G by changing the design.
- Do not change exact UI strings from SPEC §10 and §10.5.
- Do not add a feature because it seems helpful. Features not in SPEC §2.1 are not built.

## 4. Security non-goals (things never to do)

- Never put the Gemini key in client code, logs, the repo, or a variable starting with `NEXT_PUBLIC_`.
- Never read, print or commit `.env*` files (only `.env.example` is committed).
- Never log images or user text.
- Never render model output, project-file content, or user text as HTML. No `dangerouslySetInnerHTML`.
- Never use `eval`, `new Function`, or follow a field in a project file as a path, URL or command.
- M7 only: never use or store a Supabase service-role key. Never turn off or loosen Row Level Security to make a test pass. Never use upsert for saving projects. Never trust a user id sent by the client.

## 5. UI and design non-goals

- No pricing page. The landing page (`/`), `/about` and `/contact` exist by owner decision (2026-10-29); no other routes beyond the wizard at `/app` (and `/auth/callback` in M7).
- No contact form that sends or stores messages. Contact is a static page with links.
- No theme switcher or theme builder. The app is dark only.
- No 3D, WebGL, parallax, scroll-jacking, cursor trails or marquees. The only looping animations are on the landing, About and Contact pages (hero arrow ring, drifting card glows); they stop with reduced motion, and the wizard has none.
- No animation that changes what a button does, hides text from screen readers, or cannot be turned off by reduced-motion settings.
- No animating the Mermaid diagram or layout shifts that move the content the user is reading.
- No remote images, remote fonts, CDN scripts or hotlinked assets. Fonts are Inter, Space Mono and Instrument Serif through `next/font` (self-hosted).
- No paid or "Pro" Skiper UI components. No component that needs a 21st.dev API key.
- No `gsap` or other animation libraries beyond `motion`, unless a DECISIONS entry explains why a specific free component needs it.
- No copying logos, brand names, photos, copy text or artwork from a reference screenshot. Take structure, spacing, color feel and motion style only.
- No color-only meaning. Severity is always a text badge (`HIGH`, `MEDIUM`, `LOW`) plus color.
- No decoration without a job. If an element does not help the user understand or act, remove it.

## 6. Process non-goals

- Do not start milestone N+1 before the "Done when" of N passes.
- Do not skip tests to move faster.
- Do not rewrite working modules while building a different milestone.
- Do not run `/init` and overwrite `CLAUDE.md`.
- Do not stop to ask the owner questions that SPEC or these docs already answer. Ask only for a missing credential or an unresolvable conflict.
- Do not build M7 unless the owner explicitly asks. If not asked, write `M7 not requested` in `docs/FINAL_REPORT.md`.

## 7. Quick check before adding anything

1. Is it in SPEC §2.1? If no, do not build it.
2. Does it need a new dependency? If yes, log it in DECISIONS.md first, and prefer not to.
3. Does it touch a fixed contract or exact string? If yes, do not do it.
4. Does it send anything new to a server or store anything new? If yes, check §13 of SPEC and the security non-goals above.
