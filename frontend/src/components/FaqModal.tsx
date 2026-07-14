import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Modal } from './Modal';

interface FaqModalProps { open: boolean; onClose: () => void; onShowWelcome: () => void; }
interface FaqItem { q: string; a: string; }

const FAQS: FaqItem[] = [
  { q: 'What does this app do?', a: 'Dexterpreter turns Spanish audio into a timestamped Spanish transcript and then attempts an English translation. The transcript can still be edited and exported if translation is unavailable.' },
  { q: 'Does audio leave the device?', a: 'The app processes audio locally and does not send it to a transcription or translation service. Uncached model files are downloaded from their model host. Exporting, downloading, sharing, device backup, or another app can create copies outside Dexterpreter.' },
  { q: 'Does it work offline?', a: 'It can work offline after every model required by the selected workflow has downloaded successfully and remains in the device cache. Browser or operating-system storage cleanup can remove cached models, so test offline readiness before relying on it without a connection.' },
  { q: 'Why can a run need internet?', a: 'The speech and translation models are not bundled into the small app shell. Dexterpreter downloads any required model files that are not already cached on the device.' },
  { q: 'Which transcription model should I choose?', a: 'Base is the default balance. Tiny usually needs less memory and time. Small usually needs more memory and time. Actual quality varies by recording, speaker, noise, device, and model files, so compare them on your own audio rather than treating a label as proof of accuracy.' },
  { q: 'How long does processing take?', a: 'Time depends on audio length, model choice, device speed, available memory, and whether model files must download. The progress view reports the current phase without promising an exact finish time.' },
  { q: 'Which audio formats work?', a: 'The picker accepts MP3, WAV, M4A, OGG, WebM, AAC, FLAC, and MP4 audio containers. Actual decoding still depends on the browser or Android WebView codec support. The 200 MB value is an upload limit, not a guarantee that a long file will fit in memory.' },
  { q: 'How much storage does it use?', a: 'Storage varies. It includes the app, cached model files, saved transcripts, and any source audio you choose to retain. Transcript-only projects use less storage than projects that keep their original audio.' },
  { q: 'How do editing and exports work?', a: 'Use Read for sentence review and Edit words for corrections. With retained audio, transcript and translation sections can seek playback and export clips. Transcript-only projects remain fully editable but do not provide playback or clip tools.' },
  { q: 'Can I rely on it with no signal?', a: 'Prepare before disconnecting: run the selected transcription model and English translation once, confirm the result, then test again in airplane mode. A cache that worked previously may later be cleared by the browser or operating system.' },
];

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={`${id}-answer`} className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-white/[0.03] transition-colors">
        <span className="text-[13px] font-semibold text-slate-100">{item.q}</span><ChevronDown aria-hidden="true" className={`w-4 h-4 text-sky-300 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p id={`${id}-answer`} className="px-3.5 pb-3.5 -mt-1 text-[12px] text-slate-400 leading-relaxed animate-fade-in">{item.a}</p>}
    </div>
  );
}

export function FaqModal({ open, onClose, onShowWelcome }: FaqModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Frequently Asked Questions" labelledBy="faq-title">
      <div className="space-y-2">
        <button type="button" onClick={onShowWelcome} className="w-full rounded-xl border border-sky-400/20 bg-sky-500/10 px-3.5 py-2.5 text-left text-[12px] font-semibold text-sky-100 hover:bg-sky-500/15 transition-colors cursor-pointer">Show the welcome screen again</button>
        {FAQS.map((item) => <FaqRow key={item.q} item={item} />)}
      </div>
    </Modal>
  );
}
