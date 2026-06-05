import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Modal } from './Modal';

interface FaqModalProps {
  open: boolean;
  onClose: () => void;
  onShowWelcome: () => void;
}

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'What does this app do?',
    a: 'Pick a Spanish audio file and it produces a word-timestamped Spanish transcript plus an English translation. You can play the audio, edit words inline, and export everything.',
  },
  {
    q: 'Is my audio private?',
    a: 'Yes. Transcription runs entirely on your device using Whisper. Your audio is never uploaded to any server — there is no server.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. The only time it needs internet is the very first run, to download the speech model once (~85 MB). After that it works fully offline, forever.',
  },
  {
    q: 'Why does the first run need internet?',
    a: 'The Whisper model has to be downloaded once and cached on your device. Once cached, it is reused for every future transcription with no network needed.',
  },
  {
    q: 'Which model should I choose?',
    a: 'Base is the default — more accurate, ~85 MB. Tiny is faster and smaller (~45 MB) but a little less accurate. On older or slower phones, try Tiny.',
  },
  {
    q: 'How long does a transcription take?',
    a: 'It depends on the audio length and your device. Everything runs locally, so longer files take longer. A progress bar shows transcription, then translation.',
  },
  {
    q: 'What audio formats are supported?',
    a: 'Common formats your device can play: MP3, WAV, M4A, and OGG.',
  },
  {
    q: 'How much storage does it use?',
    a: 'The app itself is small (~8 MB). After the one-time model download the total on-device footprint is roughly ~95 MB.',
  },
  {
    q: 'How do I edit and export?',
    a: 'Tap any Spanish word to edit it and seek the audio to that point. Use the Export panel to save a TXT or timed JSON file, or copy the transcript and translation to your clipboard.',
  },
  {
    q: 'Can I use it with no signal, like on a plane?',
    a: 'Yes — as long as the model was downloaded once before, it needs no connection at all.',
  },
];

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-[13px] font-semibold text-slate-100">{item.q}</span>
        <ChevronDown
          className={`w-4 h-4 text-sky-300 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="px-3.5 pb-3.5 -mt-1 text-[12px] text-slate-400 leading-relaxed animate-fade-in">
          {item.a}
        </p>
      )}
    </div>
  );
}

export function FaqModal({ open, onClose, onShowWelcome }: FaqModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Frequently Asked Questions" labelledBy="faq-title">
      <div className="space-y-2">
        <button
          onClick={onShowWelcome}
          className="w-full rounded-xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-2.5 text-left text-[12px] font-semibold text-sky-100 hover:bg-sky-500/15 transition-colors cursor-pointer"
        >
          Show the welcome screen again
        </button>
        {FAQS.map((item) => (
          <FaqRow key={item.q} item={item} />
        ))}
      </div>
    </Modal>
  );
}
