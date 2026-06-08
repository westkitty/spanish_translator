import React, { useRef, useEffect, useState } from 'react';
import type { SilenceRange } from '../lib/vad';

interface AudioCanvasProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  /** Real peak-amplitude envelope [0..1], one value per bucket.
   *  Computed by computePeaks() in lib/audio.ts and passed down from App.
   *  When empty the canvas shows a low-amplitude placeholder until peaks arrive. */
  peaks?: number[];
  /** VAD silence ranges — rendered as dimmed regions so the user can see gaps. */
  silences?: SilenceRange[];
  selection?: { start: number; end: number } | null;
  selectionMode?: boolean;
  onSeek: (time: number) => void;
  onSelectRange?: (range: { start: number; end: number }) => void;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function formatAriaTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins} minutes ${secs} seconds`;
}

export function AudioCanvas({
  duration,
  currentTime,
  isPlaying: _isPlaying,
  peaks = [],
  silences = [],
  selection = null,
  selectionMode = false,
  onSeek,
  onSelectRange,
}: AudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draftSelection, setDraftSelection] = useState<{ start: number; end: number } | null>(null);

  const seekBy = (deltaSeconds: number) => {
    if (duration <= 0) return;
    onSeek(Math.max(0, Math.min(duration, currentTime + deltaSeconds)));
  };

  const timeFromClientX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const touchX = clientX - rect.left;
    const progress = Math.max(0, Math.min(touchX / rect.width, 1));
    return progress * duration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    const time = timeFromClientX(e.clientX);
    if (selectionMode) {
      setDraftSelection({ start: time, end: time });
    } else {
      onSeek(time);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScrubbing || duration <= 0) return;
    const time = timeFromClientX(e.clientX);
    if (selectionMode) {
      setDraftSelection((cur) => (cur ? { ...cur, end: time } : { start: time, end: time }));
    } else {
      onSeek(time);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (selectionMode && draftSelection) {
      const start = Math.min(draftSelection.start, draftSelection.end);
      const end = Math.max(draftSelection.start, draftSelection.end);
      if (end - start >= 0.5) {
        onSelectRange?.({ start, end });
      } else {
        onSeek(start);
      }
    }
    setIsScrubbing(false);
    setDraftSelection(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerCancel = () => {
    setIsScrubbing(false);
    setDraftSelection(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        seekBy(event.shiftKey ? -15 : -5);
        break;
      case 'ArrowRight':
        event.preventDefault();
        seekBy(event.shiftKey ? 15 : 5);
        break;
      case 'Home':
        event.preventDefault();
        onSeek(0);
        break;
      case 'End':
        event.preventDefault();
        onSeek(duration);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const canvasBg = readCssVar('--canvas-bg', '#08111f');
      const centerline = readCssVar('--waveform-centerline', 'rgba(255,255,255,0.06)');
      const playedColor = readCssVar('--accent-played', 'rgba(56,189,248,0.95)');
      const unplayedColor = readCssVar('--accent-unplayed', 'rgba(56,189,248,0.38)');
      const placeholderColor = readCssVar('--waveform-placeholder', 'rgba(56,189,248,0.22)');
      const silenceColor = readCssVar('--waveform-silence', 'rgba(148,163,184,0.14)');
      const selectionFill = readCssVar('--waveform-selection-fill', 'rgba(251,191,36,0.14)');
      const selectionStroke = readCssVar('--waveform-selection-stroke', 'rgba(252,211,77,0.7)');
      const playheadColor = readCssVar('--waveform-playhead', 'rgba(56,189,248,0.9)');
      const playheadShadow = readCssVar('--waveform-playhead-shadow', 'rgba(56,189,248,0.6)');
      const knobColor = readCssVar('--waveform-knob', '#ffffff');

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, w, h);

      // Horizontal centerline
      ctx.strokeStyle = centerline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const progress = duration > 0 ? currentTime / duration : 0;
      const playheadX = progress * w;

      // Selection / draft region
      const activeSelection = draftSelection ?? selection;
      if (activeSelection && duration > 0) {
        const selStart = Math.min(activeSelection.start, activeSelection.end);
        const selEnd = Math.max(activeSelection.start, activeSelection.end);
        const startX = (selStart / duration) * w;
        const endX = (selEnd / duration) * w;
        ctx.fillStyle = selectionFill;
        ctx.fillRect(startX, 0, Math.max(2, endX - startX), h);
        ctx.strokeStyle = selectionStroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, 0.5, Math.max(2, endX - startX), h - 1);
      }

      // Waveform bars
      const hasPeaks = peaks.length > 0;
      const numBars = hasPeaks ? peaks.length : 120;
      const barSpacing = w / numBars;
      const barWidth = Math.max(1.5, barSpacing * 0.55);

      // Precompute silence map: for each bar index, is it inside a silence range?
      const silenceAt = new Uint8Array(numBars);
      if (silences.length > 0 && duration > 0) {
        for (let b = 0; b < numBars; b++) {
          const t = ((b + 0.5) / numBars) * duration;
          for (let s = 0; s < silences.length; s++) {
            if (t >= silences[s].start && t <= silences[s].end) {
              silenceAt[b] = 1;
              break;
            }
          }
        }
      }

      for (let i = 0; i < numBars; i++) {
        const barX = i * barSpacing + barSpacing / 2;

        // Amplitude: real peak when available, placeholder otherwise.
        let amplitude: number;
        if (hasPeaks) {
          amplitude = peaks[i] ?? 0;
        } else {
          // Subtle placeholder — uniform low bars so the UI isn't blank.
          amplitude = 0.18 + 0.06 * ((i % 5) / 4);
        }

        const maxBarHeight = h * 0.78;
        const barHeight = Math.max(2, amplitude * maxBarHeight);
        const yTop = (h - barHeight) / 2;

        const isPlayed = barX <= playheadX;
        const inSilence = silenceAt[i] === 1;

        if (inSilence) {
          ctx.fillStyle = silenceColor;
        } else if (isPlayed) {
          ctx.fillStyle = playedColor;
        } else {
          ctx.fillStyle = hasPeaks ? unplayedColor : placeholderColor;
        }

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(barX - barWidth / 2, yTop, barWidth, barHeight, barWidth / 2);
        } else {
          ctx.rect(barX - barWidth / 2, yTop, barWidth, barHeight);
        }
        ctx.fill();
      }

      // Playhead line
      ctx.shadowBlur = 6;
      ctx.shadowColor = playheadShadow;
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();

      // Scrubber head
      ctx.shadowBlur = 10;
      ctx.shadowColor = playheadShadow;
      ctx.fillStyle = knobColor;
      ctx.beginPath();
      ctx.arc(playheadX, h / 2, isScrubbing ? 7 : 4.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.shadowBlur = 0;

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [peaks, silences, currentTime, draftSelection, duration, isScrubbing, selection]);

  return (
    <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/[0.12] shadow-lg">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer touch-none"
        role="slider"
        tabIndex={0}
        aria-label={selectionMode ? 'Select audio region on waveform' : 'Audio waveform seek control'}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        aria-valuenow={Math.max(0, Math.round(currentTime))}
        aria-valuetext={`${formatAriaTime(currentTime)} of ${formatAriaTime(duration)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      />
      {duration <= 0 && (
        <div className="absolute inset-0 bg-[#08111f]/80 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[11px] tracking-wider" style={{ color: 'var(--text-subtle)' }}>
            NO AUDIO LOADED
          </span>
        </div>
      )}
    </div>
  );
}
