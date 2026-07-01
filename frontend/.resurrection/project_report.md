# Project Resurrection Report: frontend

## Identity
- Name: frontend
- Path: /Users/andrew/Spanish offline transliter./frontend
- Project type: vite_app
- Confidence: 0.75
- Inferred purpose: Purpose could not be inferred confidently from filesystem signals.
- Evidence:
  - Found package.json
  - Found vite.config.ts
  - Found index.html

## Git State
- Summary: Repo root: /Users/andrew/Spanish offline transliter. | Branch: main | Status: dirty | Remote: git@github.com:westkitty/spanish_translator
- Latest commit: d696e87fc400c4d1bbc372178647dded32d9e36d chore(release): publish Dexterpreter 1.0.1 (#11)
- Tracked modified count: 0
- Untracked count: 1
- Staged count: 0

## Commands Detected
- [build] npm run build (package.json:scripts.build)
- [run/dev] npm run dev (package.json:scripts.dev)
- [run/dev] npm run eval (package.json:scripts.eval)
- [run/dev] npm run eval:gate (package.json:scripts.eval:gate)
- [run/dev] npm run preview (package.json:scripts.preview)
- [test] npm run test (package.json:scripts.test)
- [test] npm run test:watch (package.json:scripts.test:watch)
- [run/dev] npm run dev (vite.config.*)
- [build] npm run build (vite.config.*)

## Fragile Files
- eval/README.md
- package-lock.json
- package.json
- vite.config.ts

## Duplicate Or Stale Candidates
- None detected.

## Secret-Risk Findings
No secret-risk matches detected.

## Recommended Next Actions
1. Inspect the current uncommitted Git changes before making new edits.
2. Back up or review fragile configuration files before any risky changes.
3. Validate the project with the hinted test command: npm run test
4. Validate the project with the hinted run/dev command: npm run dev
5. Validate the project with the hinted build command: npm run build

## Scan Metadata
- Timestamp: 2026-06-27T18:16:15+00:00
- Scanner version: 1.0.0
