import { useState, useEffect, useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [src, setSrc] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Initialize Audio instance once
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
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
    // Bound time within [0, duration]
    const boundedTime = Math.max(0, Math.min(time, duration));
    audioRef.current.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  }, [duration]);

  return {
    src,
    isPlaying,
    currentTime,
    duration,
    setSrc,
    play,
    pause,
    togglePlay,
    seek,
  };
}
