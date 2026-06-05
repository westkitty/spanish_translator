import { Volume2, ShieldCheck, WifiOff, Languages, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: '100% private',
    body: 'Your audio is transcribed on this device and never uploaded anywhere.',
  },
  {
    icon: WifiOff,
    title: 'Works offline',
    body: 'After a one-time model download, it runs with no internet and no server.',
  },
  {
    icon: Languages,
    title: 'Spanish + English',
    body: 'Every file produces a Spanish transcript and an English translation, automatically.',
  },
];

// Full-screen welcome / onboarding gate. The user must hit "Get Started" to enter.
export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5 animate-fade-in">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center animate-scale-in">
        {/* Brand mark */}
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center glow-azure">
          <Volume2 className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-xl font-extrabold tracking-tight text-white text-azure-glow">
          Spanish Whisper Engine
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          Turn Spanish audio into an editable transcript — and an English translation —
          right on your device.
        </p>

        {/* Highlights */}
        <div className="mt-5 space-y-2.5 text-left">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-xl p-3 flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/20 flex items-center justify-center">
                <Icon className="w-4 h-4 text-sky-300" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-100">{title}</p>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="mt-6 w-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98] glow-azure flex items-center justify-center gap-2 cursor-pointer"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10px] text-slate-500 mt-3 font-mono">
          On-device &bull; Offline &bull; No account
        </p>
      </div>
    </div>
  );
}
