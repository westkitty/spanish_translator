# Spanish Whisper Engine — UI/UX Audit

**Auditor:** Claude Code (senior UI/UX auditor + frontend engineer)
**Date:** 2026-06-07
**Method:** Full source read of `frontend/src` (App + all 11 components, `index.css`, hooks/lib references) **plus** a live dev-server review (`npm run dev` on :5183) with screenshots at mobile (375×812) and tablet/desktop (1280×800) widths, plus direct DOM `inspect` to verify font sizes and layout widths.

---

## 1. Project diagnosis

### What it is
A fully **offline, on-device** Spanish audio transcription + translation app. The user picks (or records) an audio file; **Whisper runs inside the WebView** via Transformers.js (ONNX/WASM) — no server, no upload. It produces a **word-timestamped Spanish transcript** and an automatic **English translation** (Opus-MT), then lets the user scrub, edit word-by-word, loop A/B, re-run regions, and export to TXT/SRT/VTT/CSV/JSON/bilingual.

### Who the user is
Primarily **Spanish-language learners, translators, journalists, and content/subtitle creators** who need an accurate transcript of Spanish audio and a parallel English rendering, and who care about **privacy** (nothing leaves the device). The shipped artifact is an **Android APK** — and per project memory, the real target device is a **Galaxy Tab S9 Ultra (14.6" tablet)**. So this is a **large-tablet-first**, touch-first product that also runs on phones.

### Primary workflows
1. **Onboard** → Welcome gate → land on input card.
2. **Input** → choose file *or* record mic.
3. **Configure** → model tier + optional vocabulary/accuracy.
4. **Transcribe** → progress panel (download once → decode → transcribe → translate).
5. **Review/Edit** → waveform scrub + player; word editor / read view; translation panel; loop, region re-run, find&replace, undo/redo, "remember corrections".
6. **Export/Save** → 6 formats + copy; autosaved to a Library.

### Frontend stack & design system
- **React 19 + TypeScript + Vite + Tailwind v4** (CSS-variable theme).
- **Lucide** icons. **Capacitor** for the Android bridge.
- The intended design language is an **"Azure glow" glassmorphism**: deep midnight `#050912` base, breathing azure radial glow, frosted `.glass`/`.glass-strong` surfaces, sky→blue gradients (`index.css`).

### The core mismatch (headline finding)
The product is a **precision tool used on a big tablet** — yet the execution reads as a **small-phone demo skin**:
- The **waveform is fake** — `AudioCanvas.tsx` generates a random-walk amplitude array (lines 29–40); the bars and neon ribbons have **zero relationship to the actual audio**. The user scrubs and edits against a decoration. For a transcription tool, the timeline *is* the workspace; faking it quietly breaks trust and usefulness.
- There are **two competing palettes**. The shell is azure/sky-glass, but the three most-used result surfaces — `CaptionEditor`, `TranslationPanel`, `AudioCanvas` — are still on the **old indigo + `slate-700/950`** palette (`bg-indigo-600`, `text-indigo-400`, `#6366f1`). The screens the user spends the most time in clash with the brand.
- The layout **ignores the tablet**. Live `inspect` confirms `<main>` is `max-width: none` (stretches to 1232px) while modals are pinned to `max-w-sm`. On a 14.6" tablet the app is either a tiny centered column or full-width cards with absurd line lengths — **~60–70% of the screen is wasted**, and the Spanish/English panels are stacked vertically when the natural use case is **reading them side-by-side**.
- **Type is too small to read at tablet arm's length.** The codebase is saturated with `text-[10px]`/`text-[11px]` and even `text-[8px]` (export extension labels), much of it `slate-400`/`slate-500` on near-black. Verified live: the header subtitle computes to **10px**.

The bones are good (clean components, real glass styling, thoughtful copy, autosave, accessibility scaffolding in `Modal`). The problems are **consistency, legibility, layout for the real device, and one honesty bug in the core widget.**

---

## 2. The 10 improvement concepts

> Effort/Impact are **Low / Medium / High**. "Evidence" cites the exact file.

---

### #1 — Render the *real* waveform from the decoded audio
- **User problem:** The timeline is the primary workspace for scrubbing and locating words to fix — but it shows a random shape, so it gives the user **no real navigational signal** (where speech is, where the silences are, where that loud passage was). It also quietly erodes trust: a tool that fakes its core visualization invites the question "what else is fake?"
- **Evidence:** `AudioCanvas.tsx:29-40` — `amplitudes` is a `Math.random()` random walk created once at mount; never fed real samples. The neon sine "ribbons" (`drawRibbon`, lines 186–209) are pure decoration. Yet the app **already decodes real PCM** elsewhere (`decodeAudioFile` in `App.tsx:392`, used for silence detection) — the data exists.
- **Proposed change:** Compute a real peak/RMS envelope from the decoded 16 kHz PCM (downsample to ~600–1000 buckets), pass it to `AudioCanvas` as `peaks: Float32Array`. Draw real bars; overlay the already-computed `silences` (from `vad.ts`) as dim gaps so users can see pauses. Keep one subtle azure played/unplayed split; drop the three rainbow ribbons (off-brand). Cache peaks on the project record so reopened transcripts render instantly.
- **Effort:** Medium · **Impact:** High
- **Risk/tradeoff:** Extra decode/compute on load (mitigate: reuse the PCM already decoded for VAD; compute peaks in the worker; memoize). Slightly less "flashy" without the neon ribbons.
- **Validate:** Side-by-side a known clip (clap at 0:03, silence 0:10–0:14) — the envelope must show the transient and the gap. User test: "point to where the speaker pauses" should be answerable from the waveform alone.

---

### #2 — Unify the design system (kill the indigo-vs-azure split)
- **User problem:** The app feels like two products stitched together. The polished azure-glass shell sets an expectation that the editor/translation/waveform break the moment you transcribe — undermining perceived quality and brand confidence.
- **Evidence:** Shell theme = sky/azure (`index.css`, `App.tsx` gradients `from-sky-400 to-blue-600`). But `CaptionEditor.tsx` uses `bg-indigo-600`, `text-indigo-400`, `border-slate-700`, `bg-slate-950`; `TranslationPanel.tsx` uses `bg-emerald-600/20` + `border-slate-800`; `AudioCanvas.tsx` paints `#6366f1` (indigo), `#ec4899` (pink), `#06b6d4` (cyan), `#0f172a`. Active word highlight is indigo; everything else is sky. Three different "active" colors across surfaces.
- **Proposed change:** Define semantic tokens in `index.css` (`--accent`, `--accent-strong`, `--surface`, `--surface-active`, `--text`, `--text-muted`, `--text-subtle`) and refactor the three offending components to use them. Pick **one** accent (azure) for "active/selected" everywhere; reserve **one** secondary hue (emerald) only to mean "translation/English" consistently; reserve **amber** only for "destructive/re-run" warnings. Replace bespoke `slate-700/950` borders with the shared `.glass` tokens.
- **Effort:** Low–Medium · **Impact:** Medium–High
- **Risk/tradeoff:** Touches the busiest components; needs a visual regression pass. Low logical risk (style-only).
- **Validate:** Grep shows zero `indigo`/raw `slate-700|950` hex/util in components; screenshot every state and confirm a single accent for "active".

---

### #3 — Responsive two-pane (bilingual) layout for tablet
- **User problem:** The real device is a 14.6" tablet, and the real task is **reading Spanish against English**. Today both are full-width cards stacked vertically, so the user scrolls back and forth and can never see a sentence and its translation together — the single highest-value thing this app could show.
- **Evidence:** `App.tsx:499` `<main>` is a single `flex-col` with **no max-width** (verified live: `max-width:none`, width 1232px). `TranscriptView` and `TranslationPanel` are rendered as separate stacked sections (`App.tsx:836` and `:855`). Live tablet screenshot shows huge empty horizontal margins and full-bleed cards.
- **Proposed change:** Introduce a responsive grid. At `≥ lg`: **two columns** — left = player + waveform + Spanish editor; right = synchronized English translation (sticky), with the active sentence aligned/scrolled into view in both. Optionally an **interleaved bilingual "Read" mode** (ES line above EN line). Constrain content to a sensible `max-w` per column so line length stays readable. At `< md`: keep today's single-column stack.
- **Effort:** Medium–High · **Impact:** High
- **Risk/tradeoff:** Sync-scroll between panes adds complexity; needs careful handling when sentence/segment boundaries differ. Must not regress the phone layout.
- **Validate:** On a 1280+ viewport, Spanish and its English are visible together without scrolling; clicking either highlights both; phone layout unchanged. User test: "read along in both languages" with no vertical hunting.

---

### #4 — Legibility, contrast & touch-target accessibility pass
- **User problem:** On a tablet held at arm's length, the secondary text is genuinely hard to read, and several controls are below comfortable touch size. This hurts everyone and fails WCAG for low-vision users.
- **Evidence:** Pervasive `text-[10px]`/`text-[11px]`; **`text-[8px]`** export extension labels (`CaptionExport.tsx:69`); muted text is `slate-500`/`slate-400` on `#050912` (header subtitle verified at 10px). Icon buttons are `p-1.5` (~28px target, below 44px). Plus an **a11y bug:** the global key handler hijacks **Tab** to seek the next word (`App.tsx:434`), breaking keyboard focus traversal of the page whenever a result is loaded.
- **Proposed change:** Establish a type scale — body `14px` min, secondary `12px` min, micro labels `11px` floor (retire 8/10px). Raise muted text to a token that passes **4.5:1** (e.g. `slate-300/`-ish) for anything informational; reserve `slate-500` only for truly decorative text. Pad icon buttons to **≥44×44**. Scope the Tab shortcut to a modifier (or only when the editor/player is focused) so native focus order survives. Honor a single focus-ring token (already present in `index.css`).
- **Effort:** Low–Medium · **Impact:** Medium–High
- **Risk/tradeoff:** Larger text reflows dense panels; needs a spacing pass alongside. Minimal logic risk.
- **Validate:** Automated contrast check (axe) passes AA on all text; every interactive target ≥44px; keyboard-only user can Tab through header → controls in order; reduced-motion already handled.

---

### #5 — Tame the post-transcription action clutter (visual hierarchy)
- **User problem:** After transcription the screen is a flat stack of ~8 equally-weighted controls (re-run card, select-region, loop A/B, speed, "remember corrections", find/replace, undo/redo/revert, two view tabs, export). Nothing signals what's primary, so the user faces a wall of options with no path.
- **Evidence:** `App.tsx:657-866` — amber "Re-run" card, then a controls block (`Select region`, `Re-run selected region`, `Clear`), then a second block (`Speed`, `Set A`, `Set B`, loop), then "Remember my corrections", then the editor toolbar (`TranscriptView.tsx:60-85`: tabs + find + undo/redo/revert), then export. Every block is the same glass card weight.
- **Proposed change:** Establish a clear primary surface (player + editor) and demote power tools. Group **playback** (play/seek/speed/loop) into one compact transport bar; collapse **region re-run + remember-corrections** under a single "Advanced / Fix" disclosure (mirrors the pre-run `AdvancedOptions` pattern already in the app). Make **Export** and **Edit** the two visually primary post-actions.
- **Effort:** Medium · **Impact:** Medium–High
- **Risk/tradeoff:** Hiding tools reduces discoverability for power users (mitigate: persistent-but-secondary placement, remember last-open state).
- **Validate:** First-time users can find "edit a word" and "export" in <5s; tracked taps show fewer mis-taps on amber re-run.

---

### #6 — Replace native `window.confirm` with in-app confirms + success toasts
- **User problem:** Two destructive actions throw a raw OS dialog that shatters the glass aesthetic and looks untrustworthy inside a "premium" app; and most exports give **no confirmation at all** that anything was saved.
- **Evidence:** `App.tsx:285` and `:304` use `window.confirm(...)`. `CaptionExport.tsx` fires `saveTextFile` with only a `console.error` on failure — **no success UI** (only the Copy button gives feedback). On Android/Capacitor a silent save leaves users unsure it worked.
- **Proposed change:** A small reusable `ConfirmDialog` built on the existing accessible `Modal`, themed in-brand, for re-run/region-re-run. A lightweight toast/snackbar for "Saved transcript.srt", "Copied", and errors (with the saved location on native).
- **Effort:** Low–Medium · **Impact:** Medium
- **Risk/tradeoff:** Toast system is new surface area (keep it tiny; one queue). Native file-location text varies by platform.
- **Validate:** No `window.confirm` remains; every export/save shows a visible confirmation; error path surfaces a readable message, not a console log.

---

### #7 — Make word-edit mode browsable (it's currently playhead-locked)
- **User problem:** In "Edit words" mode the user can only see a ~25-second window around the playhead — to fix a word elsewhere they must scrub the audio to it first. That's a hidden, frustrating constraint for a transcript editor.
- **Evidence:** `CaptionEditor.tsx:32-46` — `windowSize` (default 25s) + `windowOffset` (-8s) means `selectVisibleWords` only returns words near `currentTime`. The empty state even says "No words in this timeline segment" with a "Jump to first word" button (`:113-122`) — i.e. the whole transcript is never shown as words at once.
- **Proposed change:** Decouple editing from the playhead: let "Edit words" scroll the **entire** transcript (virtualized by count, not by time), with the active word auto-highlighted and a "follow playback" toggle for those who want the moving window. Tie find/replace results to scroll-to-match.
- **Effort:** Medium · **Impact:** Medium
- **Risk/tradeoff:** Full-list virtualization for very long files needs windowing (react-window or manual) to stay smooth.
- **Validate:** User can scroll to and edit the last word of a 30-min file without touching the player; performance stays smooth at 10k+ words.

---

### #8 — Surface uncertainty/silence cues in the editor (honest "quality" affordance)
- **User problem:** The product markets accuracy/quality, but the editor gives **no hint about which words are risky**, so the user must re-listen to everything to trust it. A subtle "check these" cue focuses review effort.
- **Evidence:** Project overview lists "low-confidence word highlighting" as a feature, but it's **deferred** (Transformers.js doesn't expose word logprobs). The editor renders all words identically (`CaptionEditor.tsx:159-172`). `vad.ts` silences are computed and passed to `TranscriptView`/`buildSentences` but **not** shown as edit cues.
- **Proposed change:** Without true logprobs, use cheap proxies: flag words **adjacent to silences/at chunk seams**, **very short durations**, **non-dictionary tokens**, or words changed by the glossary, with a faint underline + a "review" filter. Be honest in copy ("possible spots to check", not "errors").
- **Effort:** Medium · **Impact:** Medium
- **Risk/tradeoff:** Proxies aren't ground truth — over-flagging annoys; keep it subtle and toggleable. Don't over-claim accuracy.
- **Validate:** On a clip with known errors, the flagged set has meaningfully higher error density than unflagged; users report finding fixes faster.

---

### #9 — Turn the progress spinner into a 4-stage pipeline indicator
- **User problem:** First transcription can take minutes; a single spinner + one headline makes a long, multi-stage process feel like an opaque wait — bad for performance perception and trust.
- **Evidence:** `ProgressPanel.tsx` shows one `Loader2` + a swapping headline + a bar. The stages (`decoding → loading-model → transcribing → translating`) already exist in `TranscriberStatus` but aren't shown as a structured sequence; the user can't see "3 of 4".
- **Proposed change:** A horizontal 4-step stepper — **Prepare · Download model · Transcribe · Translate** — with the current step active, past steps checked, and the "download once" step clearly one-time. Keep the friendly ETA copy (which is genuinely good). This reframes the wait as progress through known stages.
- **Effort:** Low · **Impact:** Medium
- **Risk/tradeoff:** Stages can be fast/skipped (cached model) — show the stepper adaptively so it never lies about a step that didn't run.
- **Validate:** Users can say "what's it doing now" at any moment; perceived wait (survey) drops vs. the spinner.

---

### #10 — First-run "Try a sample clip" path
- **User problem:** Onboarding dead-ends at an empty dropzone. A curious new user with no Spanish file on hand **cannot experience the product at all** — high drop-off and zero demo value at the exact moment intent is highest.
- **Evidence:** After `WelcomeScreen` is dismissed, the only path forward is picking a local file or recording (`App.tsx:503-574`). No bundled sample, no "see an example transcript".
- **Proposed change:** Bundle a tiny (~10–15s) royalty-free Spanish clip and add a "**Try a sample**" secondary button under the dropzone that loads it straight into the pipeline. Doubles as the canonical demo asset and a smoke-test fixture.
- **Effort:** Low · **Impact:** Medium (High for demo/activation)
- **Risk/tradeoff:** Adds a small asset to the bundle/APK (a few hundred KB) and still needs the one-time model download to actually run.
- **Validate:** % of new sessions that reach a transcript rises; the sample is a reliable click-to-result demo.

---

## 3. Scoring matrix

Scored **1–5, higher is better**. For *Implementation effort* and *Speed to implement*, higher = **easier/faster**. **Total** is an unweighted sum (max 35).

| # | Concept | User impact | Impl. effort (easy=5) | Strategic fit | Risk reduction | Demo value | Speed (fast=5) | Maintainability | **Total** |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Real waveform | 5 | 3 | 5 | 5 | 5 | 3 | 4 | **30** |
| 3 | Tablet two-pane bilingual | 5 | 2 | 5 | 3 | 5 | 2 | 4 | **26** |
| 4 | Legibility/contrast/a11y | 4 | 4 | 4 | 5 | 3 | 4 | 5 | **29** |
| 2 | Design-system unification | 4 | 4 | 4 | 3 | 5 | 4 | 5 | **29** |
| 9 | 4-stage progress stepper | 3 | 5 | 3 | 3 | 4 | 5 | 4 | **27** |
| 5 | Tame action clutter | 4 | 3 | 4 | 3 | 4 | 3 | 4 | **25** |
| 6 | In-app confirm + toasts | 3 | 4 | 3 | 4 | 3 | 4 | 4 | **25** |
| 10 | Sample clip onboarding | 3 | 5 | 3 | 3 | 5 | 5 | 4 | **28** |
| 7 | Browsable word editor | 4 | 3 | 4 | 3 | 3 | 3 | 3 | **23** |
| 8 | Uncertainty cues | 3 | 3 | 4 | 2 | 3 | 3 | 3 | **21** |

> Totals are close by design — several cheap wins (#9, #10, #2, #4) score high on speed. The ranking below weights **strategic fit + user impact + demo value** for *this* product over raw point totals.

---

## 4. Top 3 recommendations

### 🥇 Top 1 — Render the real waveform (#1)
**Why highest leverage:** The waveform sits in the center of the core loop (scrub → find → edit → loop). Today it is decorative noise. Fixing it converts the single most-touched element from a liability into the app's most useful instrument — and removes a credibility risk no amount of polish elsewhere can offset. Perfect strategic fit: an offline *precision* tool must not fake its core readout.
**Why it beats the others:** #3 and #4 make the app nicer; #1 makes it *honest and functional* at its core. The real PCM is **already decoded** for silence detection, so the hard part (data) is done.
**Behavior/goal improved:** Faster navigation to the passage that needs fixing; higher trust → more confident editing/export.
**First pass:** Compute a peak envelope (600–1000 buckets) from existing decoded PCM; render real bars + dim silence gaps; single azure played/unplayed split; remove the 3 neon ribbons. **Defer:** zoomable waveform, per-word amplitude alignment, color-by-confidence.
**Files:** `components/AudioCanvas.tsx` (rewrite the amplitude source + draw), `App.tsx` (pass `peaks`), reuse `lib/audio.ts` decode + `lib/vad.ts` silences; cache peaks on `lib/db.ts` project record.
**Dependencies/risks:** Decode cost on load → compute in worker / reuse VAD decode / memoize. Long files → fixed bucket count keeps it O(n) once.
**Acceptance checklist:**
- [ ] Bars derive from real samples (transient + silence visibly distinct on a known clip).
- [ ] Silences rendered as gaps; played/unplayed split uses the azure token.
- [ ] No `Math.random()` amplitudes; rainbow ribbons removed.
- [ ] Peaks cached so reopened projects render instantly.
- [ ] Phone + tablet both render correctly; reduced-motion respected.

### 🥈 Top 2 — Responsive two-pane bilingual layout (#3)
**Why highest leverage:** It aligns the app with its **actual device** (14.6" tablet) and its **actual job** (read Spanish vs. English together). It reclaims ~60–70% wasted screen and delivers the one view a bilingual user most wants but can't get today.
**Why it beats the others:** Higher ceiling than the cheap polish items; uniquely tied to the target hardware and use case. (#1 fixes a component; #3 fixes the whole information architecture for the real screen.)
**Behavior/goal improved:** Side-by-side reading/proofing without vertical hunting; better proofreading throughput; stronger demo on the device it ships on.
**First pass:** `≥ lg` two-column grid — left player+waveform+Spanish editor, right sticky synced English; click either side highlights both; per-column `max-w` for line length. **Defer:** interleaved ES/EN read mode, drag-to-resize panes, independent scroll-lock toggle.
**Files:** `App.tsx` (grid wrapper around `TranscriptView` + `TranslationPanel`), `TranslationPanel.tsx` (sticky + scroll-into-view active segment), minor `TranscriptView.tsx`.
**Dependencies/risks:** Sentence vs. segment boundary mismatch for sync-scroll; must not regress phone single-column. Ideally lands after #2 so both panes already share tokens.
**Acceptance checklist:**
- [ ] At ≥1024px, Spanish + matching English visible together, no vertical hunting.
- [ ] Active sentence/segment highlights in both panes on click/playback.
- [ ] Column line length capped (readable measure); empty space gone.
- [ ] Phone layout unchanged; no horizontal scroll at any breakpoint.

### 🥉 Top 3 — Legibility, contrast & touch-target a11y pass (#4) — bundled with design-system unification (#2)
**Why highest leverage:** It is the **cheapest broad quality lift** and the only top pick that touches *every* screen. It fixes genuine usability harm (8–11px low-contrast text at tablet distance, sub-44px targets) **and** a real keyboard a11y bug (Tab hijack). Bundling #2 (one-accent token refactor) means the same sweep that fixes sizes also fixes the indigo/azure split — two of the four headline problems closed in one pass.
**Why it beats the others (#5/#6/#9/#10):** Those each improve one moment; this raises the floor on all of them and de-risks accessibility compliance for the store/users. Highest maintainability payoff (tokens) for lowest effort.
**Behavior/goal improved:** Readability and confidence everywhere; keyboard users regain focus order; the app finally looks like one coherent product.
**First pass:** Type scale (body 14 / secondary 12 / micro 11 floor; retire 8/10px); raise informational text to a ≥4.5:1 token; pad icon buttons to ≥44px; scope the Tab shortcut; introduce semantic color tokens and refactor `CaptionEditor`/`TranslationPanel`/`AudioCanvas` off indigo/raw-slate. **Defer:** full light theme, density toggle.
**Files:** `index.css` (tokens + scale), `CaptionEditor.tsx`, `TranslationPanel.tsx`, `AudioCanvas.tsx`, `App.tsx` (key handler + micro-label sizes), `CaptionExport.tsx` (8px labels).
**Dependencies/risks:** Larger text reflows dense panels → pair with a light spacing pass. Style-only, so low logic risk.
**Acceptance checklist:**
- [ ] No text below 11px; informational text passes AA (4.5:1).
- [ ] All interactive targets ≥44×44.
- [ ] Tab no longer breaks page focus order; focus ring consistent.
- [ ] Zero `indigo`/raw `slate-700|950` color utilities in components; one accent = "active".

---

## 5. Implementation roadmap

| Wave | Items | Rationale | Rough size |
|------|-------|-----------|-----------|
| **Wave 1 — Foundation (this sprint)** | #2 tokens + #4 legibility/a11y | Style-only, unblocks everything visual; closes 2 headline issues cheaply | 1–2 days |
| **Wave 2 — Core fix** | #1 real waveform | Highest-leverage; benefits from Wave-1 tokens | 1–2 days |
| **Wave 3 — Layout** | #3 tablet two-pane | Biggest IA change; ride on shared tokens + real waveform | 2–4 days |
| **Wave 4 — Confidence & polish** | #9 stepper, #10 sample clip, #6 confirm/toasts | Cheap trust/activation wins; good demo coverage | 1–2 days |
| **Backlog** | #5 hierarchy, #7 browsable editor, #8 uncertainty cues | Higher effort or partly blocked (TJS logprobs); schedule after | — |

---

## 6. Risks & tradeoffs (cross-cutting)
- **Performance on long files:** real waveform + browsable editor must use fixed-bucket envelopes and count-based virtualization to stay O(n).
- **Don't regress the phone:** every layout change must keep the `< md` single-column intact (the app still ships to phones).
- **Honesty in copy:** uncertainty cues (#8) and the stepper (#9) must not over-claim — flag "spots to check", show only stages that actually run.
- **Reduced motion / glass cost:** keep `prefers-reduced-motion` honored; heavy `backdrop-filter` on a big tablet is already a GPU cost — don't add more animated layers (another reason to drop the neon ribbons).
- **APK discipline:** per project rule, any shipped change ends with a rebuilt **signed APK + refreshed GitHub Release** — bundle these UI changes into one release rather than many.

## 7. Validation checklist (whole effort)
- [ ] axe/Lighthouse a11y: AA contrast, target sizes, focus order all pass.
- [ ] Known-clip waveform test (transient + silence visible).
- [ ] Tablet (≥1024) shows bilingual side-by-side; phone unchanged; no horizontal scroll.
- [ ] One accent color = "active" across all surfaces; no indigo remnants.
- [ ] Every export/save shows visible confirmation; no `window.confirm`.
- [ ] New-session activation (reaches a transcript) measurably up after sample clip.
- [ ] Unit tests still green (`npm test`); clean `npm run build`.

## 8. Recommended next implementation step
Start **Wave 1**: add semantic color + type tokens to `index.css`, then refactor `CaptionEditor`, `TranslationPanel`, and `AudioCanvas` onto them while bumping every sub-12px size and padding icon buttons to 44px, and scope the Tab shortcut. It's low-risk, style-only, closes two of the four headline problems, and lays the token foundation that **#1** and **#3** build on.
