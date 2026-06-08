# App confirmation wiring plan

Date: 2026-06-08
Branch: `feature/app-confirmation-wiring`
Stack base: `feature/app-shell-refactor-prep`

## Purpose

Wire the reusable confirmation infrastructure from PR #5 into `frontend/src/App.tsx` without changing transcription, audio, storage, or export behavior.

This file exists because `App.tsx` is currently a large single-file component and the GitHub connector only supports whole-file replacement for edits. The safe implementation path is a local checkout patch or an `App.tsx` split before destructive-action logic is changed.

## Current source facts

`App.tsx` still contains two browser confirmation calls:

```ts
const handleRerun = () => {
  const confirmed = window.confirm(
    'Re-run this file? The current transcript, translation, and edits will be replaced.'
  );
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

```ts
const handleRegionRerun = () => {
  if (!file || !selectedRange) return;
  const confirmed = window.confirm(
    'Re-run just this selected region? Words and translation in that range will be replaced.'
  );
  if (!confirmed) return;
  setUndoStack((s) => [...s, captions]);
  setRedoStack([]);
  runRegion(file, selectedRange, runOptions);
};
```

## Implementation target

Use the already-added files from PR #5:

- `frontend/src/components/ConfirmDialog.tsx`
- `frontend/src/hooks/useConfirmDialog.ts`
- `frontend/src/confirm-dialog.css`

## Required App.tsx changes

### 1. Add imports

Add these imports near the existing component/hook imports:

```ts
import { ConfirmDialog } from './components/ConfirmDialog';
import { useConfirmDialog } from './hooks/useConfirmDialog';
```

### 2. Initialize the hook inside `App()`

Near other top-level hooks/state inside `App()`:

```ts
const confirmDialog = useConfirmDialog();
```

### 3. Convert `handleRerun` to async

Replace the existing `handleRerun` with:

```ts
const handleRerun = async () => {
  const confirmed = await confirmDialog.confirm({
    title: 'Re-run this file?',
    description: 'The current transcript, translation, and edits will be replaced. Your selected audio file stays loaded so you can change model or options first.',
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

### 4. Convert `handleRegionRerun` to async

Replace the existing `handleRegionRerun` with:

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

`formatRange` is already defined before render and can be referenced by `handleRegionRerun` because the function is not executed until after render-time initialization. To avoid confusion, it is acceptable to move `formatTimeStr` and `formatRange` above `handleRegionRerun` in the same local patch.

### 5. Render the dialog once

Inside the top-level returned `<div>`, near the existing modal components:

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

Recommended placement:

```tsx
{showWelcome && <WelcomeScreen onStart={handleDismissWelcome} />}
<FaqModal ... />
<LibraryModal ... />
{confirmDialog.request && <ConfirmDialog ... />}
```

## Acceptance criteria

- Re-run file no longer opens the native browser confirmation.
- Re-run region no longer opens the native browser confirmation.
- Cancel preserves transcript, translation, edits, selected range, and playback state.
- Confirm performs the exact same state changes as before.
- Dialog can be closed via cancel, backdrop, and Escape.
- Focus moves into the dialog and returns according to existing `Modal` behavior.
- Button labels are explicit: `Re-run file`, `Re-run region`, `Cancel`.
- TypeScript build passes.

## Manual QA

1. Load audio and finish transcription.
2. Click `Re-run with new settings`.
3. Verify accessible modal appears.
4. Cancel and verify transcript/translation remain unchanged.
5. Click `Re-run with new settings` again and confirm.
6. Verify existing re-run reset behavior still happens.
7. Select a waveform region.
8. Click region re-run.
9. Cancel and verify selected range remains.
10. Confirm and verify only the selected region is reprocessed.
11. Repeat in Azure, Darker, and Corporate Cream.

## Risk notes

- The main risk is accidental `App.tsx` regression during whole-file replacement.
- Avoid connector whole-file replacement unless the complete file is reconstructed and validated locally.
- Prefer local checkout patch:

```bash
git checkout feature/app-confirmation-wiring
npm install
npm run build
npm run test -- --runInBand
```

Use the repo's actual package scripts if they differ.

## Future cleanup

After confirmation wiring lands, split `App.tsx` into:

- `AppHeader.tsx`
- `InputPanel.tsx`
- `PlayerPanel.tsx`
- `ResultsLayout.tsx`
- `RerunSettingsCard.tsx`

Then move `ShellTools` into the real header and add explicit class names to retire the CSS `:has()` sticky selector.
