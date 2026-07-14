import { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import type { Translation } from '../hooks/useTranscriber';

interface TranslationPanelProps {
  translation: Translation | null;
  currentTime: number;
  onSeek: (time: number) => void;
  audioAvailable?: boolean;
}

export function TranslationPanel({ translation, currentTime, onSeek, audioAvailable = true }: TranslationPanelProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const segments = translation?.segments.filter((segment) => segment.text.trim().length > 0) ?? [];
  const activeSegmentId = segments.find((segment) => currentTime >= segment.start && currentTime <= segment.end)?.id ?? null;

  useEffect(() => {
    if (followPlayhead && activeSegmentId) {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSegmentId, followPlayhead]);

  return (
    <section className="result-section translation-section" aria-labelledby="translation-heading">
      <div className="section-heading">
        <Languages aria-hidden="true" />
        <div>
          <h2 id="translation-heading">English translation</h2>
          <p>{segments.length > 0 ? `${segments.length} translated section${segments.length === 1 ? '' : 's'}` : 'No usable translation was returned.'}</p>
        </div>
        {segments.length > 0 && (
          <button
            type="button"
            onClick={() => setFollowPlayhead((value) => !value)}
            className="compact-toggle"
            aria-pressed={followPlayhead}
          >
            {followPlayhead ? 'Following audio' : 'Follow off'}
          </button>
        )}
      </div>

      {segments.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <p>The Spanish transcript is still available. Re-run translation after checking the model files and connection.</p>
        </div>
      ) : (
        <div className="translation-list">
          {segments.map((segment) => {
            const active = currentTime >= segment.start && currentTime <= segment.end;
            return (
              audioAvailable ? (
                <button
                  key={segment.id}
                  ref={active ? activeRef : undefined}
                  type="button"
                  onClick={() => onSeek(segment.start)}
                  className="translation-segment"
                  data-active={active}
                  aria-label={`Seek to ${segment.start.toFixed(1)} seconds: ${segment.text}`}
                >
                  {segment.text}
                </button>
              ) : (
                <p key={segment.id} className="translation-segment translation-segment--static">{segment.text}</p>
              )
            );
          })}
        </div>
      )}
    </section>
  );
}
