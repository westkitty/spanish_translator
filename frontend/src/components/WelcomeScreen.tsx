import { ArrowRight, Download, HardDrive, Languages } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

const HIGHLIGHTS = [
  {
    icon: HardDrive,
    title: 'Processed on this device',
    body: 'Audio and transcripts stay in the app unless you explicitly export or share them.',
  },
  {
    icon: Download,
    title: 'Models download when needed',
    body: 'An internet connection is required for model files that are not already cached.',
  },
  {
    icon: Languages,
    title: 'Spanish transcript and English translation',
    body: 'You can edit, copy, save, and reopen completed work on this device.',
  },
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5 animate-fade-in" role="presentation">
      <div className="glass-strong w-full max-w-md rounded-3xl p-6 animate-scale-in">
        <p className="eyebrow">How Dexterpreter works</p>
        <h1 className="mt-1 text-2xl font-extrabold">Turn Spanish audio into usable text</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Choose a file or record audio, then review the Spanish transcript and English translation.
        </p>

        <div className="mt-5 space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="welcome-point">
              <Icon aria-hidden="true" />
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={onStart} className="primary-button mt-6 w-full">
          Continue <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
