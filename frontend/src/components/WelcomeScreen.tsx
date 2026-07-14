import { ArrowRight, Download, HardDrive, Languages } from 'lucide-react';
import { Modal } from './Modal';

interface WelcomeScreenProps {
  onStart: () => void;
}

const HIGHLIGHTS = [
  {
    icon: HardDrive,
    title: 'Processed locally',
    body: 'Audio is processed on this device and is not sent to a transcription service. Exporting or sharing creates copies outside the app.',
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
    <Modal open onClose={onStart} title="How Dexterpreter works" labelledBy="welcome-title">
      <div className="welcome-content">
        <p className="eyebrow">Local transcription workflow</p>
        <h2 className="mt-1 text-2xl font-extrabold">Turn Spanish audio into usable text</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Choose a file or record audio, then review the Spanish transcript and English translation.
        </p>
        <div className="mt-5 space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="welcome-point">
              <Icon aria-hidden="true" />
              <div><h3>{title}</h3><p>{body}</p></div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onStart} className="primary-button mt-6 w-full">
          Continue <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </Modal>
  );
}
