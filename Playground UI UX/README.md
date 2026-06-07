# Playground UI UX

UI/UX audit and design-direction deliverables for the **Spanish Whisper Engine** app.

Created **2026-06-07** by a source-level review of `frontend/src` (App + all 11 components, `index.css`) **plus** a live dev-server review (`npm run dev`) with screenshots at mobile (375×812) and tablet (1280×800), and direct DOM inspection to verify font sizes and layout widths.

## What's in here

| File | What it is |
|------|------------|
| **`presentation.html`** | The main deck — a self-contained, dark azure-glass HTML presentation. Title → diagnosis → all 10 ideas → scoring matrix → top 3 (with before/after + wireframes) → roadmap → risks → validation → next step. |
| **`ui-ux-audit.md`** | The full written audit and source of truth: project diagnosis, all 10 improvement concepts (problem · evidence · change · effort · impact · risk · validation), the scoring matrix, the ranked top 3 with file-level plans and acceptance checklists, roadmap, risks, and the recommended next step. |
| **`README.md`** | This file. |

## Why this format

An **HTML deck** was chosen over Markdown/PDF because:
- It can be styled in the app's own **azure-glass aesthetic**, so the presentation itself demonstrates the recommended visual direction (one accent, real glass, readable type).
- It renders an inline **before/after waveform demo** (fake random bars vs. a real envelope with a visible silence gap) and **ASCII wireframes** for the two-pane layout — visual evidence without external image assets.
- It's a single file with no build step or dependencies — opens anywhere, including the Launch preview panel.

The detailed reasoning lives in `ui-ux-audit.md` (Markdown) so it's diff-able and easy to copy into issues/PRs.

## How to view

**The deck (`presentation.html`):**
- It's already open in the **Launch preview panel**, or
- Open directly:
  ```bash
  open "Playground UI UX/presentation.html"
  ```
- Or serve the folder and browse to it:
  ```bash
  cd "Playground UI UX" && python3 -m http.server 8000   # → http://localhost:8000/presentation.html
  ```

**The audit (`ui-ux-audit.md`):** open in any Markdown viewer/editor.

## The three recommended moves (TL;DR)

1. **🥇 Real waveform** — `AudioCanvas` draws a `Math.random()` shape today; render a true peak envelope from the already-decoded PCM and show silence gaps. Fixes the core scrub/edit workspace and a trust issue.
2. **🥈 Tablet two-pane bilingual layout** — the target device is a 14.6″ tablet but `<main>` has no max-width and Spanish/English stack vertically. Add a ≥lg two-column synced layout so users read both languages at once.
3. **🥉 Legibility/contrast/a11y pass (+ design-system unify)** — retire 8–11px low-contrast text, hit ≥44px targets, fix the Tab-key focus hijack, and move the editor/translation/waveform off the stray indigo palette onto one azure token set.

## Notes & assumptions
- The live review covered the **pre-transcription** screens (welcome, upload, layout, type). The post-transcription editor/translation/export UI was assessed **from source**, because exercising it requires a one-time Whisper model download + on-device WASM inference that isn't reliable to run headless in this environment. All evidence cites exact files/lines.
- Nothing in `frontend/` was modified — these are advisory deliverables only.
