# Successor AI UI Stack Handoff

Date: 2026-06-08
Repository: `westkitty/spanish_translator`
Project surface: Dexterpreter frontend UI/UX stack
Target reader: successor AI agent plus human reviewer

## Executive summary

A stacked draft pull request series was created for the Dexterpreter frontend. The stack adds theme support, core UI controls, follow/readalong controls, sticky waveform polish, confirmation-dialog preparation, a confirmation-wiring plan, waveform accessibility/theme support, and export/editor accessibility polish.

The stack is useful but **not validated locally**. Every runtime claim must be checked with a local checkout before merge. The most fragile blocker is `frontend/src/App.tsx`: it is a large monolithic component, connector reads were truncated, and connector writes require whole-file replacement. Do not perform blind `App.tsx` surgery through connector-only tooling.

## Current PR stack

All PRs below were open, draft, and reported mergeable by the GitHub connector during this handoff pass.

| Order | PR | Title | Head branch | Base branch | Purpose | Status |
|---:|---:|---|---|---|---|---|
| 1 | #1 | `feat(ui): add theme picker foundation` | `feature/theme-picker-ui-foundation` | `main` | Adds theme model, theme picker, theme stylesheet, and translation theme token fix. | Draft, untested |
| 2 | #2 | `feat(ui): add core UX controls` | `feature/core-ux-controls` | `feature/theme-picker-ui-foundation` | Adds drag/drop overlay, toast system, shortcut help, shell tool grouping, transcript label cleanup. | Draft, untested |
| 3 | #3 | `feat(ui): add review navigation follow controls` | `feature/review-navigation-controls` | `feature/core-ux-controls` | Adds explicit follow toggles for English translation and Spanish sentence review. | Draft, untested |
| 4 | #4 | `feat(ui): add sticky transport polish` | `feature/confirmation-and-transport-polish` | `feature/review-navigation-controls` | Adds sticky waveform/player behavior through CSS. | Draft, untested |
| 5 | #5 | `feat(ui): prepare app shell confirmation refactor` | `feature/app-shell-refactor-prep` | `feature/confirmation-and-transport-polish` | Adds `ConfirmDialog`, `useConfirmDialog`, styles, and `ShellTools`; does not wire confirmations. | Draft, untested |
| 6 | #6 | `docs(ui): document app confirmation wiring plan` | `feature/app-confirmation-wiring` | `feature/app-shell-refactor-prep` | Adds exact local wiring plan for replacing `window.confirm` in `App.tsx`. | Draft, docs-only |
| 7 | #7 | `feat(ui): make waveform theme-aware and keyboard accessible` | `feature/theme-aware-waveform` | `feature/app-confirmation-wiring` | Makes `AudioCanvas` use CSS variables and adds keyboard seek/ARIA slider semantics. | Draft, untested |
| 8 | #8 | `feat(ui): polish export feedback and word editing accessibility` | `feature/export-and-editor-polish` | `feature/theme-aware-waveform` | Adds export/copy toast feedback and makes word chips real buttons. | Draft, untested |

This handoff branch is stacked on PR #8:

| PR candidate | Branch | Base | Purpose |
|---|---|---|---|
| #9 candidate | `feature/ui-stack-handoff` | `feature/export-and-editor-polish` | Adds this successor handoff and validation checklist. |

## Evidence inspected

Confirmed by direct GitHub connector reads during this pass:

- PR metadata for PR #1 through PR #8.
- `frontend/package.json` scripts and dependency metadata.
- Several high-risk source files during prior implementation passes:
  - `frontend/src/App.tsx`
  - `frontend/src/main.tsx`
  - `frontend/src/components/AudioCanvas.tsx`
  - `frontend/src/components/CaptionEditor.tsx`
  - `frontend/src/components/CaptionExport.tsx`
  - `frontend/src/components/TranslationPanel.tsx`
  - `frontend/src/components/TranscriptView.tsx`
  - `frontend/src/theme.css`
- The GitHub connector reported the stack PRs as open/draft/mergeable at the time of the relevant metadata reads.
- `frontend/package.json` defines scripts:
  - `dev`: `vite`
  - `build`: `tsc && vite build`
  - `preview`: `vite preview`
  - `test`: `vitest run`
  - `test:watch`: `vitest`
  - `eval`: `node eval/run-eval.ts`
  - `eval:gate`: `node eval/run-eval.ts --gate 0.25`

Evidence not available or not performed:

- No local filesystem checkout was available.
- No `npm install` was run.
- No TypeScript build was run.
- No Vitest suite was run.
- No browser/manual QA was run.
- No visual screenshots were inspected after these changes.
- No actual merge was performed.
- No GitHub issue was created because the available connector actions did not expose issue creation.

## Project identity

Dexterpreter is the frontend application in `westkitty/spanish_translator`. From inspected files and PR bodies, it appears to be a local/offline React + Vite + TypeScript transcription/review UI using Transformers.js and Capacitor-adjacent dependencies. The UI supports Spanish transcription, English translation, transcript editing, waveform playback/scrubbing, exports, project/library storage, microphone recording, glossary options, and evaluation scripts.

Confidence: confirmed for repository/frontend/package scripts and the directly touched UI surfaces; inferred for broader product framing from component names and existing UI copy.

## Architecture summary from inspected evidence

High-level frontend pieces touched or referenced:

- `frontend/src/App.tsx`
  - Main monolithic app shell.
  - Owns file state, model options, transcriber hook, project storage hook, recorder hook, audio player hook, rerun handlers, waveform/result layout, welcome/FAQ/library modals, and high-risk destructive-action handlers.
  - Still contains native `window.confirm` calls for full re-run and selected-region re-run.
- `frontend/src/main.tsx`
  - React root render.
  - Imports accumulated CSS layers.
  - Mounts `App`, `ShellTools`, `GlobalDropUpload`, and `ToastViewport` after the stacked PRs.
- `frontend/src/components/ThemePicker.tsx` and `frontend/src/lib/themes.ts`
  - Adds three display themes: Azure Glass, Darker, Corporate Cream.
  - Persists theme in localStorage.
  - Applies theme via `html[data-theme]`.
- `frontend/src/theme.css`
  - Token override layer after `index.css`.
  - Provides theme compatibility shims and shell UI styling.
- `frontend/src/components/GlobalDropUpload.tsx`
  - Global drag/drop overlay.
  - Bridges dropped file into existing file input using `DataTransfer`.
  - Fragile dependency: existing file input selector `input[type="file"][accept="audio/*"]`.
- `frontend/src/components/ToastViewport.tsx` and `frontend/src/lib/toast.ts`
  - Local custom-event toast system.
- `frontend/src/components/ShortcutHelp.tsx`
  - Header-edge shortcut dialog.
- `frontend/src/components/TranslationPanel.tsx`
  - English translation readalong panel with follow toggle after PR #3.
- `frontend/src/components/TranscriptView.tsx`
  - Word edit / Sentence review modes; sentence follow toggle after PR #3.
- `frontend/src/components/AudioCanvas.tsx`
  - Canvas waveform renderer.
  - After PR #7, reads CSS variables and exposes slider-like keyboard controls.
- `frontend/src/components/CaptionEditor.tsx`
  - Word-level editor; after PR #8 word chips are buttons instead of spans.
- `frontend/src/components/CaptionExport.tsx`
  - Export/copy surface; after PR #8 emits toast feedback.
- `docs/app-confirmation-wiring-plan-2026-06-08.md`
  - Exact plan for replacing `window.confirm` in `App.tsx` once local patching is available.

## Confirmed completed work by PR

### PR #1 — theme picker foundation

Confirmed created/modified files by PR body:

- `frontend/src/lib/themes.ts`
- `frontend/src/components/ThemePicker.tsx`
- `frontend/src/main.tsx`
- `frontend/src/theme.css`
- `frontend/src/components/TranslationPanel.tsx`

Purpose:

- Add Azure Glass, Darker, and Corporate Cream themes.
- Add localStorage persistence.
- Apply stored theme before React renders.
- Add accessible picker with swatches and selected state.
- Add theme CSS layer.

Risk notes:

- Theme picker is shell-mounted, not inside `App.tsx` header.
- Corporate Cream uses compatibility shims for hardcoded Tailwind classes.

### PR #2 — core UX controls

Files by PR body:

- `frontend/src/components/GlobalDropUpload.tsx`
- `frontend/src/components/ShortcutHelp.tsx`
- `frontend/src/components/ToastViewport.tsx`
- `frontend/src/components/TranscriptView.tsx`
- `frontend/src/lib/toast.ts`
- `frontend/src/main.tsx`
- `frontend/src/theme.css`

Purpose:

- Drag/drop import overlay.
- Toast system.
- Keyboard shortcut help panel.
- Header-edge shell grouping.
- Transcript label cleanup: `Word edit` and `Sentence review`.

Risk notes:

- Drag/drop depends on file input selector. If import UI changes, drop behavior can break silently.
- Shortcut list documents current shortcuts; it does not add playback shortcut logic.

### PR #3 — review navigation follow controls

Files by PR body:

- `frontend/src/components/TranslationPanel.tsx`
- `frontend/src/components/TranscriptView.tsx`
- `frontend/src/review-navigation.css`
- `frontend/src/main.tsx`

Purpose:

- Explicit follow toggle for English translation.
- Explicit follow toggle for Spanish sentence review.

Risk notes:

- Follow state is session-local and not persisted.
- Smooth scrolling behavior requires manual playback QA.

### PR #4 — sticky transport polish

Files by PR body:

- `frontend/src/transport-polish.css`
- `frontend/src/main.tsx`

Purpose:

- Sticky waveform/player card via CSS.
- Short-height opt-out.

Risk notes:

- Uses CSS `:has(canvas.touch-none)` selector because `App.tsx` player card lacks explicit class names.
- Future cleanup should add explicit player-card classes in `App.tsx` and retire this selector.

### PR #5 — app shell confirmation refactor prep

Files by PR body:

- `frontend/src/components/ConfirmDialog.tsx`
- `frontend/src/hooks/useConfirmDialog.ts`
- `frontend/src/confirm-dialog.css`
- `frontend/src/components/ShellTools.tsx`
- `frontend/src/main.tsx`

Purpose:

- Adds reusable modal confirmation component and hook.
- Adds shell tool component around theme/help controls.
- Does **not** wire re-run confirmations.

Risk notes:

- `ConfirmDialog` is unused until `App.tsx` is patched.
- Dead-code lint/build behavior is unknown until local validation.

### PR #6 — app confirmation wiring plan

Files by PR body:

- `docs/app-confirmation-wiring-plan-2026-06-08.md`

Purpose:

- Documents exact local patch to replace `window.confirm` in `App.tsx`.
- Preserves the connector limitation clearly.

Risk notes:

- Runtime behavior is unchanged.
- This doc should be the first stop before local `App.tsx` work.

### PR #7 — theme-aware waveform and keyboard accessibility

Files by PR body:

- `frontend/src/components/AudioCanvas.tsx`
- `frontend/src/waveform.css`
- `frontend/src/main.tsx`

Purpose:

- Waveform reads CSS custom properties.
- Adds keyboard seeking and slider ARIA attributes.

Risk notes:

- Canvas slider semantics are better than nothing, but a true range control may eventually be better for screen-reader users.
- Keyboard seeking must be verified against global keyboard shortcuts in `App.tsx` to ensure no duplicate/conflicting behavior.

### PR #8 — export/editor accessibility polish

Files by PR body:

- `frontend/src/components/CaptionExport.tsx`
- `frontend/src/components/CaptionEditor.tsx`

Purpose:

- Export and clipboard feedback via toasts.
- Word chips converted from clickable spans to real buttons.
- Theme-token color cleanup.

Risk notes:

- Word chip tab order can be long for dense transcript windows.
- Future editor should consider roving tabindex or virtualization if keyboard traversal becomes noisy.

## Current blockers

1. **No local validation**
   - Build/test status is unknown.
   - Manual UX status is unknown.
   - Visual layout status is unknown.

2. **`App.tsx` monolith**
   - Connector retrieval truncated full content.
   - Connector writes require whole-file replacement.
   - Blind replacement risks regressing unrelated state and UI behavior.

3. **Native confirmations still exist**
   - `window.confirm` in `handleRerun` and `handleRegionRerun` remain until the local patch from PR #6 is applied.

4. **Stacked PR burden**
   - There are eight draft PRs plus this handoff branch.
   - The stack should be validated from the top branch and merged in order or squashed intentionally.

5. **CSS selector debt**
   - `transport-polish.css` uses `:has(canvas.touch-none)` as a temporary selector because the player card lacks an explicit class.

## Fragile files and do-not-touch warnings

### `frontend/src/App.tsx`

Do not edit this through connector-only whole-file replacement unless the complete current file has been reconstructed and validated. Prefer local checkout.

Why fragile:

- Central app shell and state owner.
- Contains audio/transcription/project/recorder logic.
- Contains destructive rerun handlers.
- Large enough that connector truncation made safe full-file edits impractical.

### `frontend/src/main.tsx`

Handle carefully because it now imports multiple layered CSS files and mounts shell-level helper components.

Risk:

- Import order matters: `index.css`, `theme.css`, feature CSS layers.
- Removing shell components can break theme/help/drop/toast surfaces.

### `frontend/src/theme.css`

Token compatibility layer. Avoid casual deletions until all component hardcoded colors are replaced.

Risk:

- Corporate Cream readability relies on this layer.
- Some CSS selectors are compatibility shims for existing Tailwind literals.

### `frontend/src/transport-polish.css`

Temporary sticky-player styling.

Risk:

- Uses `:has()` selector.
- Should be replaced with explicit `player-card` class after `App.tsx` split/local patch.

### `frontend/src/components/GlobalDropUpload.tsx`

Risk:

- Depends on finding `input[type="file"][accept="audio/*"]`.
- If `App.tsx` input UI changes, drag/drop can stop loading files.

### `frontend/src/components/AudioCanvas.tsx`

Risk:

- Canvas rendering loop and pointer selection behavior are timing-sensitive.
- New keyboard handling must be checked against existing global shortcuts.

## Known contradictions / tension ledger

| Topic | Tension | Recommended resolution |
|---|---|---|
| Theme picker placement | PR #1 originally says move picker into App header later; PR #2/#5 keep shell-level tools mounted in `main.tsx`. | Leave shell-mounted until `App.tsx` is split or locally patched. Then move `ShellTools` into real header. |
| Confirmation replacement | PR #5 adds infrastructure; PR #6 documents plan; native confirms remain. | Apply PR #6 plan locally. Do not claim done until native confirms are removed and build passes. |
| Sticky transport | PR #4 adds sticky behavior without App class names. | Add explicit player-card class in local `App.tsx` patch, then replace `:has()` selector. |
| Accessibility depth | PR #7 gives canvas slider semantics; ideal audio controls would be semantic buttons/range. | Accept current improvement as interim; future transport refactor should add true semantic controls. |
| Word-chip keyboarding | PR #8 makes every visible word tabbable. | Keep for accessibility now; consider roving tabindex if tab order becomes noisy. |

## Local validation commands

From repository root:

```bash
git fetch origin

git checkout feature/export-and-editor-polish
cd frontend
npm install
npm run build
npm run test
npm run eval
npm run eval:gate
npm run dev
```

Notes:

- `feature/export-and-editor-polish` includes PR #1 through PR #8 because the branches are stacked.
- This handoff branch `feature/ui-stack-handoff` adds docs only on top of PR #8.
- If dependencies are already installed, `npm install` may be replaced with the repo's preferred install command after checking for a lockfile.
- The exact package scripts are confirmed from `frontend/package.json`.

## Manual QA checklist after build passes

Use one browser session per theme where possible.

### Theme and shell tools

- Start app.
- Verify default theme loads.
- Open theme picker.
- Switch to Azure Glass, Darker, and Corporate Cream.
- Refresh and verify theme persists.
- Open shortcut help.
- Close shortcut help with Escape.
- Verify focus return.
- Verify no overlap between shell tools and existing header buttons.

### Drag/drop and import

- Drag an MP3/WAV/M4A/OGG over app.
- Verify overlay appears.
- Drop file while import UI is available.
- Verify file loads and success toast appears.
- Drop a non-audio file.
- Verify warning behavior.

### Transcription/review basics

- Run transcription using recommended/default model.
- Verify Spanish transcript appears.
- Verify English translation appears if expected.
- Verify project save/autosave does not error.

### Follow controls

- Play audio.
- Verify English translation follows active segment by default.
- Turn translation follow off.
- Scroll manually and verify playback does not yank scroll.
- Turn follow back on.
- Repeat for Spanish `Sentence review` mode.

### Waveform

- Verify waveform colors under each theme.
- Pointer scrub waveform.
- Select a region if region selection mode exists.
- Tab to waveform.
- ArrowLeft/ArrowRight seek 5 seconds.
- Shift+ArrowLeft/Shift+ArrowRight seek 15 seconds.
- Home seeks to start.
- End seeks to end.
- Verify global Space/Arrow shortcuts still behave sensibly.

### Sticky transport

- Scroll through long transcript/translation.
- Verify player/waveform card remains usable.
- Resize to short viewport.
- Verify sticky behavior disables and does not trap the screen.

### Export/editor polish

- Export TXT/SRT/VTT/CSV/JSON/Bilingual formats.
- Verify success toast for each.
- Copy transcript + translation.
- Verify success toast.
- Try clipboard denial/failure if possible.
- Tab into Word edit mode.
- Verify word chips are reachable.
- Activate word chip by keyboard.
- Save edit with Enter/check button.
- Cancel edit with Escape/X button.

### Confirmation migration after future local patch

Only after applying PR #6's plan:

- Trigger full re-run.
- Verify custom modal, not native browser confirmation.
- Cancel and verify no state loss.
- Confirm and verify old reset behavior still occurs.
- Trigger region re-run.
- Cancel and verify selection remains.
- Confirm and verify only selected region reprocesses.

## Recommended merge strategy

Safest path:

1. Locally check out the top runtime branch: `feature/export-and-editor-polish`.
2. Run build/test/eval/manual QA.
3. If clean, mark PRs #1–#8 ready for review.
4. Merge PRs in order, one at a time:
   - #1 into `main`
   - #2 into #1 branch or rebase/retarget to updated `main`
   - #3 into #2 branch or rebase/retarget
   - continue through #8
5. After each merge, ensure the next PR base is updated or GitHub recognizes the stack correctly.
6. Merge this handoff branch if you want the handoff docs preserved in `main`.

Alternative path:

- Squash the full stack into one local branch after build/test passes.
- Open one consolidated PR.
- Use this handoff as the review guide.

Do not merge blindly just because GitHub reports mergeable. Mergeable means no obvious Git conflict. It does not mean TypeScript compiles. Tiny distinction. Large consequences.

## First recommended next step for successor AI

Do this first:

```bash
git fetch origin
git checkout feature/export-and-editor-polish
cd frontend
npm install
npm run build
npm run test
```

Then report exact output. Do not modify code until build/test status is known.

## Second recommended next step

If build/test pass, start manual QA using the checklist above. If build fails, fix the smallest failing file first. Likely suspects from this stack:

- missing imports or unused imports after stacked edits
- React/TypeScript ARIA prop typing on canvas slider
- CSS import order problems
- toast helper import path
- `DataTransfer` availability assumptions in drag/drop code

## Third recommended next step

Apply `docs/app-confirmation-wiring-plan-2026-06-08.md` in a local checkout to replace native confirmations. Keep it as a separate PR unless the full UI stack has already been consolidated.

## Successor-AI operating instructions

- Treat build/test status as unknown until verified.
- Do not say the UI works until browser QA is performed.
- Do not edit `App.tsx` through connector-only whole-file replacement.
- Preserve the stacked PR order unless you intentionally consolidate locally.
- Keep changes small and reversible.
- When touching colors, prefer CSS variables and theme tokens.
- When touching controls, preserve 44px minimum targets where practical.
- When touching transcript navigation, verify playback and scroll behavior together.
- When touching waveform behavior, verify pointer, keyboard, and region selection together.
- When touching export behavior, verify both success and failure paths.

## Confidence map

| Claim | Confidence | Reason |
|---|---|---|
| PRs #1–#8 exist and are open draft PRs | Confirmed | PR metadata was read through GitHub connector. |
| PRs #1–#8 were reported mergeable during this pass | Confirmed at time of inspection | GitHub connector metadata showed `mergeable: true` for each. |
| Build/test status is unknown | Confirmed | No local command execution was available/performed. |
| `App.tsx` remains the main blocker | Confirmed/inferred | Direct file inspection showed browser confirms and large monolithic structure; connector truncation blocked safe full-file replacement. |
| Theme/export/editor/waveform changes compile | Unknown | Must be checked locally. |
| Manual UI behavior works | Unknown | Must be checked in browser. |
| Confirmation dialog wiring is ready to apply | Likely | PR #5 added infrastructure and PR #6 documents exact wiring, but runtime build not verified. |

## Appendix: created branches and docs

Created branches in this session:

- `feature/theme-picker-ui-foundation`
- `feature/core-ux-controls`
- `feature/review-navigation-controls`
- `feature/confirmation-and-transport-polish`
- `feature/app-shell-refactor-prep`
- `feature/app-confirmation-wiring`
- `feature/theme-aware-waveform`
- `feature/export-and-editor-polish`
- `feature/ui-stack-handoff`

Created/important docs:

- `docs/app-confirmation-wiring-plan-2026-06-08.md`
- `docs/successor-ai-ui-stack-handoff-2026-06-08.md`

If this handoff branch is merged, the successor should start with this file and the confirmation wiring plan before touching code.
