# Codex Continuation Handoff Prompt

Date: 2026-06-08
Repository: `westkitty/spanish_translator`
Primary working branch for continuation: `feature/ui-stack-finalize-codex`
Base branch to create from: `feature/ui-stack-handoff`

## Paste this prompt into Codex

You are Codex taking over the `westkitty/spanish_translator` project after a ChatGPT GitHub-connector UI/UX pass. Your job is to validate, finish, and prepare the stacked Spanish Whisper Engine frontend PR series for merge. Be conservative, source-grounded, and exact. Do not claim anything works until you run the commands or manually verify it.

### Mission

Finish the UI/UX stack safely:

1. Validate the current stacked branch locally.
2. Fix any TypeScript/build/test failures caused by the stacked PRs.
3. Apply the documented `App.tsx` confirmation-wiring patch if build/test state allows it.
4. Replace native browser `window.confirm` calls with the existing `ConfirmDialog` / `useConfirmDialog` infrastructure.
5. Add explicit player/result class names in `App.tsx` if safely possible, then retire or narrow the temporary CSS `:has()` selector in `transport-polish.css`.
6. Run build/test/eval again.
7. Perform or document manual QA status.
8. Stage, commit, and push your completed work.
9. Leave a clear final report with exact commands run and exact results.

### Verified repo docs you must read first

These files exist on branch `feature/ui-stack-handoff`. They were verified by the previous assistant before this handoff was written.

Read them in this order:

1. `docs/successor-ai-ui-stack-handoff-2026-06-08.md`
   - Full stack map, risk ledger, branch order, fragile files, next steps.

2. `docs/ui-stack-validation-checklist-2026-06-08.md`
   - Command checklist, manual QA checklist, stop signs, triage order.

3. `docs/app-confirmation-wiring-plan-2026-06-08.md`
   - Exact local patch plan for replacing browser confirmations in `frontend/src/App.tsx`.

4. `docs/codex-continuation-handoff-2026-06-08.md`
   - This prompt.

Do not skip these. They are not decorative. They are the map through the corpse pile.

### Current PR stack you are inheriting

The prior assistant opened a stacked draft PR series. At the time of handoff, all were open and draft. Treat mergeability as stale until you verify.

1. PR #1 — `feat(ui): add theme picker foundation`
   - Branch: `feature/theme-picker-ui-foundation`
   - Base: `main`

2. PR #2 — `feat(ui): add core UX controls`
   - Branch: `feature/core-ux-controls`
   - Base: `feature/theme-picker-ui-foundation`

3. PR #3 — `feat(ui): add review navigation follow controls`
   - Branch: `feature/review-navigation-controls`
   - Base: `feature/core-ux-controls`

4. PR #4 — `feat(ui): add sticky transport polish`
   - Branch: `feature/confirmation-and-transport-polish`
   - Base: `feature/review-navigation-controls`

5. PR #5 — `feat(ui): prepare app shell confirmation refactor`
   - Branch: `feature/app-shell-refactor-prep`
   - Base: `feature/confirmation-and-transport-polish`

6. PR #6 — `docs(ui): document app confirmation wiring plan`
   - Branch: `feature/app-confirmation-wiring`
   - Base: `feature/app-shell-refactor-prep`

7. PR #7 — `feat(ui): make waveform theme-aware and keyboard accessible`
   - Branch: `feature/theme-aware-waveform`
   - Base: `feature/app-confirmation-wiring`

8. PR #8 — `feat(ui): polish export feedback and word editing accessibility`
   - Branch: `feature/export-and-editor-polish`
   - Base: `feature/theme-aware-waveform`

9. PR #9 — `docs(ui): add successor handoff for UI stack`
   - Branch: `feature/ui-stack-handoff`
   - Base: `feature/export-and-editor-polish`

Your working branch should be based on `feature/ui-stack-handoff`, because it includes the runtime stack plus the handoff docs.

### Important project facts

Frontend package path:

```bash
frontend/package.json
```

Confirmed scripts in `frontend/package.json`:

```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "eval": "node eval/run-eval.ts",
  "eval:gate": "node eval/run-eval.ts --gate 0.25"
}
```

Frontend dependency stack from inspected `package.json` includes React 19, Vite, TypeScript, Vitest, Tailwind 4, Capacitor packages, Lucide React, and `@huggingface/transformers`.

### Critical warnings

#### 1. `frontend/src/App.tsx` is fragile

`App.tsx` is a large monolithic component. The prior assistant could inspect chunks but could not safely rewrite it through GitHub connector tooling. You are local. That means you can safely patch it, but only after you inspect it fully.

Before editing `App.tsx`:

```bash
git status --short
sed -n '1,220p' frontend/src/App.tsx
sed -n '220,520p' frontend/src/App.tsx
sed -n '520,940p' frontend/src/App.tsx
```

Do not blindly paste a whole replacement over `App.tsx`.

#### 2. Build/test status is unknown

No local `npm install`, build, test, eval, or browser QA was run by the previous assistant. All code PRs are draft and unvalidated.

#### 3. Native confirmations remain

`frontend/src/App.tsx` still contains two `window.confirm` call sites unless someone already fixed them after this handoff. Verify with:

```bash
grep -n "window.confirm\|handleRerun\|handleRegionRerun" frontend/src/App.tsx
```

#### 4. Sticky transport CSS uses a temporary selector

`frontend/src/transport-polish.css` uses a `:has(canvas.touch-none)` selector because the player card in `App.tsx` did not have a stable class. If you add an explicit class in `App.tsx`, retire or narrow the `:has()` selector.

#### 5. Drag/drop depends on the existing file input

`frontend/src/components/GlobalDropUpload.tsx` bridges dropped audio into:

```ts
input[type="file"][accept="audio/*"]
```

If `App.tsx` changes the file input, update this bridge or move drop handling directly into App state.

### Required initial commands

From repo root:

```bash
git fetch origin

git checkout feature/ui-stack-handoff

git pull --ff-only origin feature/ui-stack-handoff

git checkout -b feature/ui-stack-finalize-codex

git status --short
```

Then inspect the required docs:

```bash
sed -n '1,260p' docs/successor-ai-ui-stack-handoff-2026-06-08.md
sed -n '1,240p' docs/ui-stack-validation-checklist-2026-06-08.md
sed -n '1,260p' docs/app-confirmation-wiring-plan-2026-06-08.md
```

Then validate install/build/test from the frontend directory:

```bash
cd frontend
npm install
npm run build
npm run test
npm run eval
npm run eval:gate
```

If any command fails, stop and classify the failure before editing.

### Failure triage order

If build/test fails, check in this order:

1. Missing imports.
2. Unused imports rejected by TypeScript.
3. React/TypeScript ARIA prop typing, especially `AudioCanvas.tsx`.
4. CSS import path mistakes in `main.tsx`.
5. Toast helper import path mistakes.
6. `ConfirmDialog` or `useConfirmDialog` dead-code or typing issues.
7. Drag/drop `DataTransfer` typing assumptions.
8. Theme CSS syntax issues.
9. Only then inspect broader behavior.

Make the smallest fix that restores build/test. Do not refactor casually.

### Required implementation: replace browser confirmations

After initial build/test status is known, apply `docs/app-confirmation-wiring-plan-2026-06-08.md`.

The target files already exist from PR #5:

```bash
frontend/src/components/ConfirmDialog.tsx
frontend/src/hooks/useConfirmDialog.ts
frontend/src/confirm-dialog.css
```

Verify they exist:

```bash
test -f frontend/src/components/ConfirmDialog.tsx && echo PASS ConfirmDialog
test -f frontend/src/hooks/useConfirmDialog.ts && echo PASS useConfirmDialog
test -f frontend/src/confirm-dialog.css && echo PASS confirm-dialog.css
```

Then update `frontend/src/App.tsx`.

#### Add imports

Near the other imports:

```ts
import { ConfirmDialog } from './components/ConfirmDialog';
import { useConfirmDialog } from './hooks/useConfirmDialog';
```

#### Initialize hook inside `App()`

Near other hooks/state:

```ts
const confirmDialog = useConfirmDialog();
```

#### Replace `handleRerun`

Replace the current browser-confirming version with:

```ts
const handleRerun = async () => {
  const confirmed = await confirmDialog.confirm({
    title: 'Re-run this file?',
    description:
      'The current transcript, translation, and edits will be replaced. Your selected audio file stays loaded so you can change model or options first.',
    confirmLabel: 'Re-run file',
    tone: 'warning',
  });
  if (!confirmed) return;

  pause();
  seek(0);
  setSelectedRange(null);
  setSelectRegionMode(false);
  setSilences([]);
  setPeaks([]);
  projectBaseRef.current = null;
  pendingSaveRef.current = false;
  resetHistory();
  reset();
};
```

#### Replace `handleRegionRerun`

Replace the current browser-confirming version with:

```ts
const handleRegionRerun = async () => {
  if (!file || !selectedRange) return;

  const confirmed = await confirmDialog.confirm({
    title: 'Re-run selected region?',
    description: `Words and translation between ${formatRange(selectedRange)} will be replaced. Everything outside that range will be kept.`,
    confirmLabel: 'Re-run region',
    tone: 'warning',
  });
  if (!confirmed) return;

  setUndoStack((s) => [...s, captions]);
  setRedoStack([]);
  runRegion(file, selectedRange, runOptions);
};
```

If `formatRange` is declared below `handleRegionRerun`, move `formatTimeStr` and `formatRange` above it. Do not rely on temporal dead-zone behavior for callbacks if the code becomes unclear.

#### Render the dialog once

Inside the top-level JSX return, near existing modal components:

```tsx
{confirmDialog.request && (
  <ConfirmDialog
    open={Boolean(confirmDialog.request)}
    title={confirmDialog.request.title}
    description={confirmDialog.request.description}
    confirmLabel={confirmDialog.request.confirmLabel}
    cancelLabel={confirmDialog.request.cancelLabel}
    tone={confirmDialog.request.tone}
    onConfirm={confirmDialog.handleConfirm}
    onCancel={confirmDialog.handleCancel}
  />
)}
```

Recommended placement is near `WelcomeScreen`, `FaqModal`, and `LibraryModal` render sites.

#### Verify native confirms are gone

```bash
grep -n "window.confirm" frontend/src/App.tsx || echo "PASS no native confirmations"
```

### Recommended implementation: explicit player class

If you are already safely editing `App.tsx`, identify the player/waveform card that renders `AudioCanvas`. Add an explicit class such as:

```tsx
className="player-card glass ..."
```

Then update `frontend/src/transport-polish.css` to prefer `.player-card` rather than the temporary selector:

```css
main .player-card {
  position: sticky;
  top: 0.25rem;
  z-index: 30;
}
```

You may leave a fallback `:has()` selector only if needed, but prefer explicit class targeting.

### Required validation after code edits

From `frontend/`:

```bash
npm run build
npm run test
npm run eval
npm run eval:gate
```

If any command fails, fix or document the failure exactly. Do not continue to manual QA claiming success.

### Manual QA checklist

Run `npm run dev`, open the local Vite URL, and test:

#### Theme and shell tools

- Theme picker opens.
- Azure Glass readable.
- Darker readable.
- Corporate Cream readable.
- Theme persists after refresh.
- Shortcut help opens and closes with Escape.
- Focus return works.
- Floating controls do not cover core header actions.

#### Drag/drop import

- Drag audio file over app: overlay appears.
- Drop valid audio: file loads and success toast appears.
- Drop invalid file: clear warning/no-load behavior.
- Existing file picker still works.

#### Transcription baseline

- Load or record audio.
- Run transcription.
- Spanish transcript appears.
- English translation appears if expected.
- Project save/autosave does not throw console errors.

#### Follow controls

- Translation follows active segment by default.
- Turning follow off stops forced scrolling.
- Turning follow on resumes active-segment scrolling.
- Sentence review follow toggle behaves the same.

#### Waveform

- Pointer seek works.
- Region selection works.
- Canvas focus ring visible.
- ArrowLeft/ArrowRight seek 5 seconds.
- Shift+ArrowLeft/Shift+ArrowRight seek 15 seconds.
- Home seeks to start.
- End seeks to end.
- Waveform colors are readable in all three themes.

#### Sticky player

- Player/waveform sticks while reviewing long transcript.
- Sticky player does not cover header controls.
- Short viewport disables sticky behavior.

#### Export/editor

- TXT/SRT/VTT/CSV/JSON/Bilingual export success toasts appear.
- Copy transcript + translation success toast appears.
- Failed save/copy paths show error toast if failure can be induced.
- Tab reaches word chips in Word edit mode.
- Keyboard activation opens edit input.
- Enter saves edit.
- Escape cancels edit.
- Check/X buttons work.

#### Confirmations

- Full re-run opens custom modal, not native browser confirmation.
- Cancel preserves state.
- Confirm performs old reset behavior.
- Region re-run opens custom modal.
- Cancel preserves selected range.
- Confirm reprocesses selected range.

### Required final repo hygiene

Before committing:

```bash
git status --short
```

Review every changed file. Do not commit generated build artifacts unless this repo already tracks them intentionally.

Stage intentional changes:

```bash
git add frontend/src/App.tsx \
  frontend/src/transport-polish.css \
  docs/codex-continuation-handoff-2026-06-08.md
```

Adjust `git add` paths to include any other intentionally modified source files. Do not blindly `git add .` unless you have inspected `git status --short` and confirmed every path is intended.

Commit:

```bash
git commit -m "feat(ui): finalize stacked UI handoff and confirmations"
```

Push:

```bash
git push -u origin feature/ui-stack-finalize-codex
```

If you make only docs or validation notes, use:

```bash
git commit -m "docs(ui): record stacked UI validation results"
```

### Required final report

Your final response must include:

1. Branch name pushed.
2. Commit SHA.
3. Exact commands run.
4. Exact pass/fail status for:
   - `npm install`
   - `npm run build`
   - `npm run test`
   - `npm run eval`
   - `npm run eval:gate`
5. Whether `window.confirm` remains in `frontend/src/App.tsx`.
6. Whether manual QA was completed.
7. Any failures that remain.
8. Files changed.
9. Whether PR stack should be merged as-is, rebased, or consolidated.

### Stop signs

Stop and report instead of guessing if:

- Build fails in multiple unrelated areas.
- `App.tsx` changes become large or confusing.
- Drag/drop breaks the normal file picker.
- Waveform keyboard controls conflict with existing global shortcuts.
- Corporate Cream becomes low contrast.
- Project save/autosave throws errors.
- Confirmation wiring causes state loss on cancel.

### Expected final state

A good completion state looks like this:

- `feature/ui-stack-finalize-codex` exists locally and on origin.
- Build/test/eval status is known.
- Native `window.confirm` calls are gone or explicitly documented as still pending with reason.
- Any TypeScript failures caused by the stacked PRs are fixed.
- Manual QA has either been performed or explicitly deferred with reason.
- Changes are staged, committed, and pushed.
- The final report is factual and does not overclaim.

Do the work carefully. The previous assistant made useful PRs but could not validate them. Your job is not to be impressive. Your job is to make the stack safe.
