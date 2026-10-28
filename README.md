# RealityCompiler

A plan checker for software ideas. Show it a plan (sketch photo, screenshot or typed text). It turns the plan into a state machine with Gemma 4, checks it with deterministic code, asks you about each gap, and exports a specification.

Work in progress. The full README (install, environment, demo walkthrough, project files, tests, free-tier limits) is written in milestone M6.

## Quick start

```
npm install
cp .env.example .env.local   # add GEMINI_API_KEY, or set MOCK_GEMMA=1 to run offline
npm run dev                  # http://localhost:3000
```

## Checks

```
npm run typecheck
npm run lint
npm test
```
