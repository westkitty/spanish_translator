import React, { useRef, useEffect, useState } from 'react';

interface AudioCanvasProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

export function AudioCanvas({ duration, currentTime, isPlaying, onSeek }: AudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Generate a deterministic waveform shape
  const [amplitudes] = useState(() => {
    const arr = [];
    let current = 0.5;
    for (let i = 0; i < 150; i++) {
      // Random walk with bounds
      current += (Math.random() - 0.5) * 0.25;
      if (current < 0.1) current = 0.15;
      if (current > 0.9) current = 0.85;
      arr.push(current);
    }
    return arr;
  });

  const handleTouch = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const touchX = clientX - rect.left;
    const progress = Math.max(0, Math.min(touchX / rect.width, 1));
    onSeek(progress * duration);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsScrubbing(true);
    if (e.touches.length > 0) {
      handleTouch(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      handleTouch(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    setIsScrubbing(false);
  };

  // Mouse fallback for local testing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsScrubbing(true);
    handleTouch(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isScrubbing) {
      handleTouch(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsScrubbing(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsScrubbing(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      // Clear Canvas
      ctx.clearRect(0, 0, w, h);

      // Draw dark background panel
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, w, h);

      // 1. Draw horizontal guide line
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Compute progress
      const progress = duration > 0 ? currentTime / duration : 0;
      const playheadX = progress * w;

      // 2. Draw vertical waveform bars
      const numBars = amplitudes.length;
      const barSpacing = w / numBars;
      const barWidth = Math.max(1.5, barSpacing * 0.6);

      for (let i = 0; i < numBars; i++) {
        const barX = i * barSpacing + barSpacing / 2;
        const amplitude = amplitudes[i];
        const barHeight = amplitude * (h * 0.7);

        // Highlight bars that have already been played
        const isPlayed = barX <= playheadX;
        ctx.fillStyle = isPlayed ? '#6366f1' : '#475569'; // indigo-500 or slate-600

        // Rounded vertical bars
        const yTop = (h - barHeight) / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(barX - barWidth / 2, yTop, barWidth, barHeight, barWidth / 2);
        } else {
          ctx.rect(barX - barWidth / 2, yTop, barWidth, barHeight);
        }
        ctx.fill();
      }

      // 3. Draw animated glowing wave ribbon when playing/active
      if (isPlaying) {
        phaseRef.current += 0.04;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const drawRibbon = (color: string, amplitudeScale: number, speedScale: number, freqScale: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let x = 0; x < w; x++) {
          // Combination of sine waves
          const y = h / 2 + 
            Math.sin(x * 0.015 * freqScale + phaseRef.current * speedScale) * 12 * amplitudeScale +
            Math.cos(x * 0.007 * freqScale - phaseRef.current * 0.7 * speedScale) * 6 * amplitudeScale;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      };

      // Draw three overlapping ribbons for a premium neon feel
      drawRibbon('rgba(99, 102, 241, 0.45)', 1.0, 1.0, 1.0);  // Indigo-500
      drawRibbon('rgba(236, 72, 153, 0.3)', 0.8, 1.3, 1.4);   // Pink-500
      drawRibbon('rgba(6, 182, 212, 0.35)', 1.2, 0.7, 0.7);   // Cyan-500

      ctx.restore();

      // 4. Draw seek scrubber position overlay (vertical neon line + circle)
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#6366f1';
      ctx.strokeStyle = '#818cf8'; // indigo-400
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();

      // Scrubber head circle
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(playheadX, h / 2, isScrubbing ? 8 : 5, 0, 2 * Math.PI);
      ctx.fill();

      // Reset shadows
      ctx.shadowBlur = 0;

      // Loop rendering
      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [amplitudes, currentTime, duration, isPlaying, isScrubbing]);

  return (
    <div className="relative w-full h-24 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {duration <= 0 && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center pointer-events-none select-none">
          <span className="text-slate-400 text-xs tracking-wider">NO AUDIO LOADED</span>
        </div>
      )}
    </div>
  );
}
