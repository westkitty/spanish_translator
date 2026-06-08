# UI Stack Validation Checklist

Date: 2026-06-08
Repository: `westkitty/spanish_translator`
Top runtime branch to validate: `feature/export-and-editor-polish`
Handoff docs branch: `feature/ui-stack-handoff`

## Rule zero

Do not merge any UI stack PR until local build/test and browser QA have been run. GitHub mergeable is not the same as working. Obvious, somehow still worth saying.

## PR review order

1. PR #1 — `feat(ui): add theme picker foundation`
2. PR #2 — `feat(ui): add core UX controls`
3. PR #3 — `feat(ui): add review navigation follow controls`
4. PR #4 — `feat(ui): add sticky transport polish`
5. PR #5 — `feat(ui): prepare app shell confirmation refactor`
6. PR #6 — `docs(ui): document app confirmation wiring plan`
7. PR #7 — `feat(ui): make waveform theme-aware and keyboard accessible`
8. PR #8 — `feat(ui): polish export feedback and word editing accessibility`
9. PR candidate from `feature/ui-stack-handoff` — docs only

## Local command checklist

From repo root:

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

If `npm install` is not the repo standard after checking lockfiles, use the project-standard package manager instead.

## Build/test triage

If `npm run build` fails, inspect first for:

- missing imports
- unused imports rejected by TypeScript settings
- React ARIA prop typing on `AudioCanvas`
- CSS import path typo
- toast helper import path
- `ConfirmDialog`/`useConfirmDialog` dead-code or lint issues

If `npm run test` fails, classify whether failure is:

- pre-existing test failure
- UI behavior changed intentionally
- real regression
- environment/setup failure

Do not patch broad areas before identifying which category applies.

## Browser QA checklist

### Themes

- App loads.
- Theme picker opens.
- Azure Glass readable.
- Darker readable.
- Corporate Cream readable.
- Theme persists after refresh.
- Theme picker closes on Escape and outside click.

### Header/shell tools

- Shortcut/help button opens dialog.
- Escape closes dialog.
- Focus return works.
- Floating controls do not cover core header actions.

### Drag/drop

- Drag audio over app: overlay appears.
- Drop valid audio: file loads and success toast appears.
- Drop invalid/non-audio: warning or no-load behavior is clear.
- Existing file picker still works.

### Transcription baseline

- Choose/record audio.
- Run transcription.
- Confirm Spanish transcript appears.
- Confirm English translation appears if expected.
- Confirm progress panel does not regress.
- Confirm library/autosave behavior does not throw console errors.

### Follow controls

- Translation panel follows active segment by default.
- Turning follow off stops forced scrolling.
- Turning follow on resumes active-segment scrolling.
- Sentence review follow toggle behaves the same.

### Waveform

- Pointer seek still works.
- Region selection still works.
- Canvas focus ring visible.
- ArrowLeft/ArrowRight seek 5 seconds.
- Shift+ArrowLeft/Shift+ArrowRight seek 15 seconds.
- Home seeks to start.
- End seeks to end.
- Waveform colors are readable in all three themes.

### Sticky player

- Player/waveform sticks while reviewing long transcript.
- Sticky player does not cover header controls.
- Short viewport disables sticky behavior.

### Export

- TXT export succeeds with toast.
- SRT export succeeds with toast.
- VTT export succeeds with toast.
- CSV export succeeds with toast.
- JSON export succeeds with toast.
- Bilingual export succeeds with toast.
- Copy transcript + translation succeeds with toast.
- Failed save/copy paths show error toast if failure can be induced.

### Word editor

- Switch to Word edit mode.
- Tab reaches word chips.
- Keyboard activation opens edit input.
- Edit input receives focus and selects word.
- Enter saves edit.
- Escape cancels edit.
- Check and X buttons work.
- Footer hint matches behavior.

## Confirmation wiring after PR #6 plan is applied locally

Not implemented in the current runtime stack. After applying `docs/app-confirmation-wiring-plan-2026-06-08.md`:

- Full re-run opens custom modal, not `window.confirm`.
- Cancel preserves state.
- Confirm performs old reset behavior.
- Region re-run opens custom modal.
- Cancel preserves selected range.
- Confirm reprocesses selected range.

## Known stop signs

Stop and report instead of continuing if:

- `App.tsx` needs connector-only whole-file replacement.
- Build fails in multiple unrelated files.
- Drag/drop breaks normal file input.
- Keyboard waveform seek conflicts with global playback shortcuts.
- Corporate Cream becomes low contrast.
- Autosave/library behavior regresses.

## First safe fix order

1. Fix missing imports or obvious TypeScript errors.
2. Fix CSS import paths.
3. Fix ARIA/type errors.
4. Fix toast/notification import issues.
5. Only then touch behavior.
6. Touch `App.tsx` last, and preferably locally.
