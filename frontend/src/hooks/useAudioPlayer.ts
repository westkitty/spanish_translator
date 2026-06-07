import { useState, useEffect, useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [loopRange, setLoopRangeState] = useState<{ start: number; end: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const loopRangeRef = useRef<{ start: number; end: number } | null>(null);

  // Initialize Audio instance once
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const loop = loopRangeRef.current;
      if (loop && audio.currentTime >= loop.end) {
        audio.currentTime = loop.start;
      }
      // Never let a non-finite clock through: a NaN currentTime would silently
      // hide the entire (time-windowed) transcript downstream.
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    };

    const onDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const onPlay = () => {
      setIsPlaying(true);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = (e: ErrorEvent) => {
      console.error('Audio error event:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError as any);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError as any);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    loopRangeRef.current = loopRange;
  }, [loopRange]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Update source when src state changes
  useEffect(() => {
    if (!audioRef.current) return;
    
    // Pause and clear active promises
    audioRef.current.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (src) {
      audioRef.current.src = src;
      audioRef.current.load();
    } else {
      audioRef.current.src = '';
    }
  }, [src]);

  const play = useCallback(() => {
    if (!audioRef.current || !src) return;
    
    // standard check to avoid abort-promise exceptions
    try {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromiseRef.current = playPromise;
        playPromise.catch((err) => {
          console.warn('Audio play request interrupted or failed:', err);
          setIsPlaying(false);
        });
      }
    } catch (err) {
      console.error('Error calling audio.play():', err);
    }
  }, [src]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;

    if (playPromiseRef.current) {
      playPromiseRef.current
        .then(() => {
          audioRef.current?.pause();
        })
        .catch(() => {
          // Promise was rejected, still pause
          audioRef.current?.pause();
        });
    } else {
      audioRef.current.pause();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    if (!Number.isFinite(time)) return; // ignore NaN seeks (e.g. from an unloaded clock)
    // Bound time within [0, duration]. `duration` is 0 until metadata loads;
    // don't let that clamp a valid seek to 0, and never produce a NaN.
    const upper = Number.isFinite(duration) && duration > 0 ? duration : time;
    const boundedTime = Math.max(0, Math.min(time, upper));
    audioRef.current.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  }, [duration]);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
  }, []);

  const setLoopRange = useCallback((range: { start: number; end: number }) => {
    const start = Math.max(0, Math.min(range.start, range.end));
    const end = Math.max(start, Math.max(range.start, range.end));
    setLoopRangeState(end - start >= 0.5 ? { start, end } : null);
  }, []);

  const clearLoopRange = useCallback(() => {
    setLoopRangeState(null);
  }, []);

  return {
    src,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    loopRange,
    setSrc,
    setPlaybackRate,
    setLoopRange,
    clearLoopRange,
    play,
    pause,
    togglePlay,
    seek,
  };
}
